import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type { SupportHost, SupportMessage } from "./host.ts";
import type { SupportStateStore } from "./state-store.ts";

const MESSAGE_ID = /^om_[A-Za-z0-9_-]+$/u;

/**
 * Accepts user text from private chats and from group chats that @mention the bot.
 * Group chatter that does not address the bot is ignored before reaching the host or model.
 */
export function decodeMessage(value: unknown, tenantId: string, botOpenId: string): SupportMessage | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid event");
	const event = value as Record<string, unknown>;
	if (
		event.type !== "im.message.receive_v1" ||
		(event.chat_type !== "p2p" && event.chat_type !== "group") ||
		event.sender_type !== "user" ||
		// Replies with a quote and other formatted messages arrive as "post"; the CLI pre-renders both to text.
		(event.message_type !== "text" && event.message_type !== "post")
	)
		return undefined;
	for (const [field, pattern] of [
		["sender_id", /^ou_[A-Za-z0-9_-]+$/u],
		["chat_id", /^oc_[A-Za-z0-9_-]+$/u],
		["message_id", MESSAGE_ID],
	] as const) {
		if (typeof event[field] !== "string" || !pattern.test(event[field]) || event[field].length > 256)
			throw new Error("Invalid event identity");
	}
	if (typeof event.content !== "string" || event.content.length > 8000) throw new Error("Invalid event text");
	let text = event.content;
	let threadId: string | undefined;
	let otherMentions: { id: string; name: string }[] = [];
	if (event.chat_type === "group") {
		const mentions = Array.isArray(event.mentions) ? event.mentions : [];
		const botMentions = mentions.filter(
			(mention): mention is Record<string, unknown> =>
				!!mention && typeof mention === "object" && (mention as Record<string, unknown>).id === botOpenId,
		);
		if (botMentions.length === 0) return undefined;
		// Rendered content may keep the display name or the placeholder key; remove only the bot's own mention.
		for (const mention of botMentions) {
			for (const token of [mention.name, mention.key]) {
				if (typeof token === "string" && token)
					text = text.replaceAll(token.startsWith("@") ? token : `@${token}`, " ");
			}
		}
		// Other people @mentioned in the message (e.g. "@someone 处理中") stay addressable by open ID.
		otherMentions = mentions
			.filter(
				(mention): mention is Record<string, unknown> =>
					!!mention &&
					typeof mention === "object" &&
					typeof (mention as Record<string, unknown>).id === "string" &&
					/^ou_[A-Za-z0-9_-]+$/u.test((mention as Record<string, unknown>).id as string) &&
					(mention as Record<string, unknown>).id !== botOpenId,
			)
			.map((mention) => ({
				id: mention.id as string,
				name: typeof mention.name === "string" ? mention.name.slice(0, 100) : "",
			}));
		// A thread is identified by its root message: the first @ starts it, later replies carry root_id.
		const root =
			typeof event.root_id === "string" && MESSAGE_ID.test(event.root_id) ? event.root_id : event.message_id;
		threadId = String(root);
	}
	text = text.trim();
	// A bare @ in a group is a request for help, not an invalid event.
	if (!text && threadId) text = "/help";
	if (!text) throw new Error("Invalid event text");
	// Flattened CLI events have no tenant field; this binding is configured for one verified app/profile only.
	return {
		tenantId,
		chatType: event.chat_type,
		userId: String(event.sender_id),
		chatId: String(event.chat_id),
		...(threadId ? { threadId } : {}),
		...(otherMentions.length ? { mentions: otherMentions } : {}),
		messageId: String(event.message_id),
		text,
	};
}

export function replyKey(messageId: string): string {
	const hex = createHash("sha256").update(`step-code-bot:${messageId}`).digest("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function deliverMessage(
	message: SupportMessage,
	host: SupportHost,
	store: SupportStateStore,
	reply: (id: string, text: string, key: string) => Promise<void>,
	indicator?: {
		create(messageId: string): Promise<string>;
		remove(messageId: string, reactionId: string): Promise<void>;
		failed(): void;
	},
): Promise<void> {
	let reactionId: string | undefined;
	try {
		const result = await host.handle(
			message,
			indicator
				? async () => {
						try {
							reactionId = await indicator.create(message.messageId);
						} catch {
							indicator.failed();
						}
					}
				: undefined,
		);
		if (!result) return;
		const claim = store.claimReply(message.messageId);
		if (claim === "done") return;
		if (claim === "pending") throw new Error("Uncertain outgoing reply requires reconciliation");
		await reply(message.messageId, result.reply, replyKey(message.messageId));
		store.completeReply(message.messageId);
	} finally {
		if (reactionId && indicator) {
			try {
				await indicator.remove(message.messageId, reactionId);
			} catch {
				indicator.failed();
			}
		}
	}
}

/** Keeps stdin open, waits for the CLI readiness marker and fails on possible event loss. */
export async function consumeMessages(
	tenantId: string,
	botOpenId: string,
	handle: (message: SupportMessage) => Promise<void>,
	signal: AbortSignal,
	log: (status: string) => void,
	start?: () => ChildProcessWithoutNullStreams,
): Promise<void> {
	const child = start
		? start()
		: spawn("lark-cli", ["--profile", "step-code-bot", "event", "consume", "im.message.receive_v1", "--as", "bot"], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" },
			});
	let ready = false;
	let pending = 0;
	let stdout = "";
	let stderr = "";
	let failure = false;
	let queue = Promise.resolve();
	let releaseReady = () => {};
	const readiness = new Promise<void>((resolve) => {
		releaseReady = resolve;
	});
	const stop = () => {
		releaseReady();
		child.stdin.end();
		child.kill("SIGTERM");
	};
	const fail = () => {
		failure = true;
		log("transport-failed");
		stop();
	};
	const startup = setTimeout(fail, 30000);
	signal.addEventListener("abort", stop, { once: true });
	if (signal.aborted) stop();
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => {
		stderr += chunk;
		if (stderr.length > 65536) {
			fail();
			return;
		}
		let end = stderr.indexOf("\n");
		while (end >= 0) {
			const line = stderr.slice(0, end);
			stderr = stderr.slice(end + 1);
			if (line.trim() === "[event] ready event_key=im.message.receive_v1") {
				ready = true;
				releaseReady();
				clearTimeout(startup);
				log("transport-ready");
			} else if (/warn|drop|"ok"\s*:\s*false/iu.test(line)) fail();
			end = stderr.indexOf("\n");
		}
	});
	child.stdout.on("data", (chunk: string) => {
		stdout += chunk;
		if (stdout.length > 65536) {
			fail();
			return;
		}
		let end = stdout.indexOf("\n");
		while (end >= 0 && !failure) {
			const line = stdout.slice(0, end);
			stdout = stdout.slice(end + 1);
			if (line.trim()) {
				if (++pending > 20) {
					fail();
					return;
				}
				queue = queue
					.then(async () => {
						await readiness;
						if (!ready || failure || signal.aborted) return;
						try {
							const event: unknown = JSON.parse(line);
							const message = decodeMessage(event, tenantId, botOpenId);
							if (message) await handle(message);
							else if (
								event &&
								typeof event === "object" &&
								(event as Record<string, unknown>).chat_type === "group"
							) {
								// No message content. Mention shape only (truncated id, key, name) to diagnose a bot-ID mismatch.
								const mentions = (event as Record<string, unknown>).mentions;
								const shape = Array.isArray(mentions)
									? mentions
											.map((m) => {
												const r = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
												const id = typeof r.id === "string" ? r.id.slice(0, 10) : typeof r.id;
												return `${id}|${String(r.key ?? "")}|${String(r.name ?? "").slice(0, 20)}`;
											})
											.join(",")
									: "";
								log(
									`group-message-ignored type=${String((event as Record<string, unknown>).message_type)} mentions=${Array.isArray(mentions) ? mentions.length : 0} shape=${shape}`,
								);
							}
						} catch {
							log("message-failed-reconcile-if-pending");
						}
					})
					.finally(() => {
						pending--;
					});
			}
			end = stdout.indexOf("\n");
		}
	});
	try {
		await new Promise<void>((resolve, reject) => {
			child.once("error", () => reject(new Error("Cannot start bot transport")));
			child.once("close", (code) => {
				if (signal.aborted && !failure) resolve();
				else reject(new Error(`Bot transport stopped (${code ?? "signal"}); restart required`));
			});
		});
	} finally {
		clearTimeout(startup);
		signal.removeEventListener("abort", stop);
		stop();
		await queue;
	}
}
