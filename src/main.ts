import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { loadSupportConfig } from "./config.ts";
import { DesktopFeedbackAdapter } from "./desktop-feedback.ts";
import { FeedbackDiagnostics } from "./diagnostics.ts";
import { FeedbackAdapter } from "./feedback.ts";
import { SupportHost } from "./host.ts";
import { SupportKnowledge } from "./knowledge.ts";
import { LarkCliClient } from "./lark-client.ts";
import { createSupportModel, SupportAnswerer } from "./model.ts";
import { SupportStateStore } from "./state-store.ts";
import { consumeMessages, deliverMessage } from "./transport.ts";

async function main(): Promise<void> {
	process.umask(0o077);
	const [command, configPath, messageId, outcome] = process.argv.slice(2);
	if (!["run", "check", "pending", "reconcile", "ack-reply"].includes(command ?? "") || !configPath) {
		throw new Error(
			"Usage: main.ts run|check|pending|reconcile|ack-reply <config.json> [message-id] [verified-record-id|close-without-retry]",
		);
	}
	const config = loadSupportConfig(configPath);
	const lock = createServer();
	await new Promise<void>((resolve, reject) => {
		lock.once("error", () =>
			reject(new Error("Service lock unavailable; stop other instances or inspect stale socket")),
		);
		lock.listen(join(config.stateDir, "service.sock"), resolve);
	});
	let ownedStore: SupportStateStore | undefined;
	try {
		const store = new SupportStateStore(join(config.stateDir, "support.sqlite"));
		ownedStore = store;
		if (command === "pending") {
			console.log(JSON.stringify({ operations: store.listPending(), replies: store.listPendingReplies() }));
			return;
		}
		if (command === "reconcile") {
			const pending = store.listPending().filter((item) => item.messageId === messageId);
			if (pending.length !== 1 || !outcome)
				throw new Error("Choose exactly one pending message and an operator-verified outcome");
			store.reconcilePending(
				pending[0].conversationKey,
				pending[0].messageId,
				outcome === "close-without-retry" ? undefined : outcome,
			);
			console.log("Operation reconciled; no remote write or resend performed");
			return;
		}
		if (command === "ack-reply") {
			if (!messageId || outcome !== "close-without-retry" || !store.listPendingReplies().includes(messageId))
				throw new Error("Choose a pending reply and close-without-retry after remote inspection");
			store.completeReply(messageId);
			console.log("Reply closed without resending");
			return;
		}
		const client = new LarkCliClient();
		await client.verifyIdentity();
		const knowledge = new SupportKnowledge(config.repositoryDir);
		const call = await createSupportModel(readFileSync(config.apiKeyFile, "utf8").trim(), config.stateDir);
		if (command === "check") {
			console.log(
				`Configuration and bot identity checked; snapshot=${knowledge.snapshot}; knowledge sources=${knowledge.paths.join(",")}; diagnostics dashboard=${config.dashboardBaseUrl}. Model API, message transport and dashboard not exercised.`,
			);
			return;
		}
		const answerer = new SupportAnswerer(call, knowledge, store, config.dailyRequests);
		const diagnostics = new FeedbackDiagnostics(config.dashboardBaseUrl, config.stateDir, {
			reserve: (count) => store.reserveModelRequests(config.dailyRequests, count),
			call,
		});
		const feedback = new FeedbackAdapter(client, store);
		const desktopFeedback = new DesktopFeedbackAdapter(client, store);
		const privateUsers = new Set(config.allowedUsers);
		const groups = new Set(config.allowedChats);
		const host = new SupportHost(store, {
			// Group: every member of a configured group. Private chat: configured owners only.
			admit: async (message) =>
				message.tenantId === config.tenantId &&
				(message.chatType === "group" ? groups.has(message.chatId) : privateUsers.has(message.userId)),
			redirect: (message) =>
				message.chatType === "p2p" && !privateUsers.has(message.userId)
					? "私聊暂未开放。请在 Step Code 支持群里 @Step Code助手 提问，回复会放在话题里。"
					: undefined,
			answer: (text, context) => answerer.answer(text, context),
			reviewFeedback: (text) => answerer.reviewFeedback(text),
			resetContext: async (key) => {
				answerer.resetContext(key);
			},
			status: async () =>
				`服务正在处理消息；知识快照 ${knowledge.snapshot}。保留最近相关问题用于追问（30 分钟；群话题内共享，私聊仅本人），重启后清空；Feedback ID 空值需人工补齐。模型与反馈 API 健康以实际请求结果为准。`,
			registerFeedback: (input) => feedback.registerFeedback(input),
			registerDesktopFeedback: async (input) => {
				const result = await desktopFeedback.register(input);
				// The record exists; the duplicate hint is best-effort and must never fail the delivery.
				try {
					const active = await desktopFeedback.listActiveReports(result.recordId);
					const match = await answerer.detectDuplicateReport(input.description, active);
					if (match) {
						const existing = active.find((item) => item.recordId === match.recordId);
						const marker = `｜疑似与 ${match.recordId} 重复：${existing?.description.slice(0, 30) ?? ""}${
							match.reason ? `（${match.reason}）` : ""
						}｜PM 确认后归并`;
						await desktopFeedback.flagSuspectedDuplicate(result.recordId, result.note + marker);
						return { ...result, suspectedDuplicate: match };
					}
				} catch {
					// No hint beats a failed reply: the record is already safely in the table.
				}
				return result;
			},
			diagnose: (feedbackId) => diagnostics.diagnose(feedbackId),
		});
		const controller = new AbortController();
		const stop = () => controller.abort();
		process.once("SIGTERM", stop);
		process.once("SIGINT", stop);
		try {
			await consumeMessages(
				config.tenantId,
				config.botOpenId,
				async (message) => {
					await deliverMessage(
						message,
						host,
						store,
						(id, text, key) => client.reply(id, text, key, message.chatType === "group"),
						{
							create: (id) => client.createWorkingReaction(id),
							remove: (id, reactionId) => client.removeWorkingReaction(id, reactionId),
							failed: () => console.log("working-reaction-failed"),
						},
					);
				},
				controller.signal,
				(status) => console.log(status),
			);
		} finally {
			process.removeListener("SIGTERM", stop);
			process.removeListener("SIGINT", stop);
		}
	} finally {
		try {
			ownedStore?.close();
		} finally {
			await new Promise<void>((resolve) => lock.close(() => resolve()));
		}
	}
}

main().catch(() => {
	console.error(
		"Support bot stopped. Check configuration and pending operations; credentials and API errors are intentionally not logged.",
	);
	process.exitCode = 1;
});
