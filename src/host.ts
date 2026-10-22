import {
	type CommandActions,
	type CommandContext,
	type CommandState,
	handleSupportCommand,
	parseSupportCommand,
} from "./commands.ts";
import { containsSensitiveInput } from "./config.ts";
import type { SupportStateStore } from "./state-store.ts";

export interface SupportMessage {
	tenantId: string;
	chatType: "p2p" | "group";
	userId: string;
	chatId: string;
	/** Group thread root message; group threads share follow-up context among participants. */
	threadId?: string;
	messageId: string;
	text: string;
}

export interface SupportHostActions extends Omit<CommandActions, "saveState"> {
	/** Authenticate scope and check privacy/feedback policy before any action. */
	admit(message: SupportMessage): Promise<boolean>;
	/** Fixed reply for senders who must use another channel; no state, model or feedback action runs. */
	redirect?(message: SupportMessage): string | undefined;
	answer(text: string, context: CommandContext): Promise<string>;
	reviewFeedback?(text: string): Promise<boolean>;
}

export class SupportHost {
	private readonly store: SupportStateStore;
	private readonly actions: SupportHostActions;

	constructor(store: SupportStateStore, actions: SupportHostActions) {
		this.store = store;
		this.actions = actions;
	}

	async handle(
		message: SupportMessage,
		onModelStart?: () => Promise<void>,
	): Promise<{ reply: string; replayed: boolean } | undefined> {
		if (
			![message.tenantId, message.userId, message.chatId, message.messageId].every(
				(id) => id.length > 0 && id.length <= 256,
			)
		) {
			throw new Error("Invalid trusted message identity");
		}
		if (message.threadId !== undefined && (message.threadId.length === 0 || message.threadId.length > 256)) {
			throw new Error("Invalid trusted thread identity");
		}
		if (message.text.length > 8000) throw new Error("Message exceeds support input limit");
		if (message.chatType === "group" && message.threadId === undefined) {
			throw new Error("Group messages require a thread root");
		}
		const redirect = this.actions.redirect?.(message);
		if (redirect !== undefined) return { reply: redirect, replayed: false };
		if (!(await this.actions.admit(message))) return undefined;
		// Per-person key: command state, delivery ledger and feedback ownership never mix between people.
		const conversationKey = JSON.stringify([
			message.tenantId,
			message.userId,
			message.chatId,
			message.threadId ?? "",
		]);
		// Follow-up memory: shared by everyone in one group thread, private to one person in p2p.
		const memoryKey =
			message.chatType === "group"
				? JSON.stringify([message.tenantId, "thread", message.chatId, message.threadId])
				: conversationKey;
		return this.store.execute(conversationKey, message.messageId, message.text, async (state) => {
			if (containsSensitiveInput(message.text)) {
				return { state, reply: "消息疑似包含凭据，未提交模型或反馈表。请撤回并脱敏；已暴露的凭据建议轮换。" };
			}
			const command = parseSupportCommand(message.text);
			if (
				(!command ||
					(command.type === "feedback" && this.actions.reviewFeedback) ||
					command.type === "diagnose" ||
					command.type === "desktop") &&
				onModelStart
			) {
				await onModelStart();
			}
			if (
				command?.type === "feedback" &&
				this.actions.reviewFeedback &&
				!(await this.actions.reviewFeedback(command.description))
			) {
				return {
					state,
					reply: "未登记：只接受明确的 Step Code 缺陷或功能建议，请脱敏并说明与 Step Code 的关系。范围校验失败或预算不足时也不会写表。",
				};
			}
			let next: CommandState = state;
			const context: CommandContext = {
				conversationKey,
				memoryKey,
				origin: {
					chatType: message.chatType,
					userId: message.userId,
					chatId: message.chatId,
					...(message.threadId ? { threadId: message.threadId } : {}),
				},
				messageId: message.messageId,
				state,
			};
			const reply =
				(await handleSupportCommand(message.text, context, {
					resetContext: (key) => this.actions.resetContext(key),
					status: () => this.actions.status(),
					registerFeedback: (input) => this.actions.registerFeedback(input),
					registerDesktopFeedback: this.actions.registerDesktopFeedback
						? (input) => this.actions.registerDesktopFeedback?.(input)
						: undefined,
					diagnose: (feedbackId) => this.actions.diagnose?.(feedbackId) ?? Promise.resolve("诊断功能当前未启用。"),
					// The store commits this staged projection together with the completed reply.
					saveState: async (_key, value) => {
						next = value;
					},
				})) ?? (await this.actions.answer(message.text, context));
			return { state: next, reply };
		});
	}
}
