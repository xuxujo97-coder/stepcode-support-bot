import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { CommandState } from "./commands.ts";

export interface StoredCommandResult {
	state: CommandState;
	reply: string;
}

/** Host projections and delivery ledger, never authoritative agent sessions. */
export class SupportStateStore {
	private readonly database: DatabaseSync;
	private readonly queues = new Map<string, Promise<void>>();

	constructor(path: string) {
		this.database = new DatabaseSync(path, { timeout: 5000 });
		this.database.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = FULL;
			CREATE TABLE IF NOT EXISTS conversations (
				conversation_key TEXT PRIMARY KEY,
				state TEXT NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS deliveries (
				conversation_key TEXT NOT NULL,
				message_id TEXT NOT NULL,
				input_hash TEXT NOT NULL,
				status TEXT NOT NULL CHECK(status IN ('pending', 'done')),
				reply TEXT,
				PRIMARY KEY (conversation_key, message_id)
			) STRICT;
			CREATE UNIQUE INDEX IF NOT EXISTS one_pending_per_conversation
				ON deliveries(conversation_key) WHERE status = 'pending';
			CREATE TABLE IF NOT EXISTS feedback_owners (
				record_id TEXT PRIMARY KEY,
				conversation_key TEXT NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS model_budget (
				day TEXT PRIMARY KEY,
				requests INTEGER NOT NULL
			) STRICT;
			CREATE TABLE IF NOT EXISTS outgoing (
				message_id TEXT PRIMARY KEY,
				status TEXT NOT NULL CHECK(status IN ('pending', 'done'))
			) STRICT;
		`);
	}

	reserveModelRequests(limit: number, count: number): boolean {
		if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(count) || count < 1 || limit < 1) {
			throw new Error("Invalid model request budget");
		}
		if (count > limit) return false;
		const day = new Date().toISOString().slice(0, 10);
		const result = this.database
			.prepare(`
			INSERT INTO model_budget VALUES (?, ?)
			ON CONFLICT(day) DO UPDATE SET requests = requests + excluded.requests
			WHERE requests + excluded.requests <= ?
		`)
			.run(day, count, limit);
		return result.changes === 1;
	}

	claimReply(messageId: string): "new" | "pending" | "done" {
		const row = this.database.prepare("SELECT status FROM outgoing WHERE message_id = ?").get(messageId);
		if (row) return row.status === "done" ? "done" : "pending";
		this.database.prepare("INSERT INTO outgoing VALUES (?, 'pending')").run(messageId);
		return "new";
	}

	completeReply(messageId: string): void {
		this.database.prepare("UPDATE outgoing SET status = 'done' WHERE message_id = ?").run(messageId);
	}

	listPendingReplies(): string[] {
		return this.database
			.prepare("SELECT message_id FROM outgoing WHERE status = 'pending'")
			.all()
			.map((row) => {
				if (typeof row.message_id !== "string") throw new Error("Invalid outgoing delivery");
				return row.message_id;
			});
	}

	listPending(): { conversationKey: string; messageId: string }[] {
		return this.database
			.prepare("SELECT conversation_key, message_id FROM deliveries WHERE status = 'pending'")
			.all()
			.map((row) => {
				if (typeof row.conversation_key !== "string" || typeof row.message_id !== "string")
					throw new Error("Invalid pending delivery");
				return { conversationKey: row.conversation_key, messageId: row.message_id };
			});
	}

	rememberFeedbackOwner(recordId: string, conversationKey: string): void {
		const row = this.database
			.prepare("SELECT conversation_key FROM feedback_owners WHERE record_id = ?")
			.get(recordId);
		if (row) {
			if (row.conversation_key !== conversationKey) throw new Error("Feedback ownership conflict");
			return;
		}
		this.database.prepare("INSERT INTO feedback_owners VALUES (?, ?)").run(recordId, conversationKey);
	}

	ownsFeedback(recordId: string, conversationKey: string): boolean {
		const row = this.database
			.prepare("SELECT conversation_key FROM feedback_owners WHERE record_id = ?")
			.get(recordId);
		return row?.conversation_key === conversationKey;
	}

	/** Operator-only: close one pending operation after remote inspection, never retrying the write. */
	reconcilePending(conversationKey: string, messageId: string, recordId?: string): void {
		if (recordId !== undefined && !recordId.startsWith("rec")) throw new Error("Invalid verified record ID");
		this.database.exec("BEGIN IMMEDIATE");
		try {
			const row = this.database
				.prepare("SELECT status FROM deliveries WHERE conversation_key = ? AND message_id = ?")
				.get(conversationKey, messageId);
			if (row?.status !== "pending") throw new Error("Operation is not pending");
			if (recordId) {
				this.rememberFeedbackOwner(recordId, conversationKey);
				this.database
					.prepare(
						"INSERT INTO conversations VALUES (?, ?) ON CONFLICT(conversation_key) DO UPDATE SET state = excluded.state",
					)
					.run(conversationKey, JSON.stringify({ feedback: { recordId } }));
			}
			this.database
				.prepare("UPDATE deliveries SET status = 'done', reply = ? WHERE conversation_key = ? AND message_id = ?")
				.run(
					recordId
						? "管理员已核对并恢复原反馈关联，未重复创建记录。"
						: "管理员已结束该请求的自动处理；未自动重试，远端结果请联系管理员核实。",
					conversationKey,
					messageId,
				);
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	readState(conversationKey: string): CommandState {
		const row = this.database
			.prepare("SELECT state FROM conversations WHERE conversation_key = ?")
			.get(conversationKey);
		if (!row) return {};
		if (typeof row.state !== "string") throw new Error("Invalid stored command state");
		const value: unknown = JSON.parse(row.state);
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid stored command state");
		// Older rows may carry keys (version, feedbackId) that are no longer part of state; they are ignored.
		if (!("feedback" in value) || value.feedback === undefined) return {};
		const feedback: unknown = value.feedback;
		if (
			!feedback ||
			typeof feedback !== "object" ||
			!("recordId" in feedback) ||
			typeof feedback.recordId !== "string" ||
			!feedback.recordId
		)
			throw new Error("Invalid stored command state");
		return { feedback: { recordId: feedback.recordId } };
	}

	async execute(
		conversationKey: string,
		messageId: string,
		input: string,
		work: (state: CommandState) => Promise<StoredCommandResult>,
	): Promise<{ reply: string; replayed: boolean }> {
		if (!conversationKey || !messageId) throw new Error("Missing trusted message scope");
		const previous = this.queues.get(conversationKey) ?? Promise.resolve();
		let release = () => {};
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.queues.set(conversationKey, current);
		await previous;
		try {
			const inputHash = createHash("sha256").update(input).digest("hex");
			const delivery = this.database
				.prepare("SELECT input_hash, status, reply FROM deliveries WHERE conversation_key = ? AND message_id = ?")
				.get(conversationKey, messageId);
			if (delivery) {
				if (delivery.input_hash !== inputHash) throw new Error("Duplicate message payload changed");
				if (delivery.status !== "done" || typeof delivery.reply !== "string") {
					throw new Error("Pending operation requires reconciliation");
				}
				return { reply: delivery.reply, replayed: true };
			}
			if (
				this.database
					.prepare("SELECT 1 FROM deliveries WHERE conversation_key = ? AND status = 'pending'")
					.get(conversationKey)
			) {
				throw new Error("Pending operation requires reconciliation");
			}
			const state = this.readState(conversationKey);
			// Persist the claim before invoking anything that can mutate remote records.
			this.database
				.prepare(
					"INSERT INTO deliveries (conversation_key, message_id, input_hash, status) VALUES (?, ?, ?, 'pending')",
				)
				.run(conversationKey, messageId, inputHash);
			const result = await work(state);
			this.database.exec("BEGIN IMMEDIATE");
			try {
				this.database
					.prepare(
						"INSERT INTO conversations VALUES (?, ?) ON CONFLICT(conversation_key) DO UPDATE SET state = excluded.state",
					)
					.run(conversationKey, JSON.stringify(result.state));
				this.database
					.prepare(
						"UPDATE deliveries SET status = 'done', reply = ? WHERE conversation_key = ? AND message_id = ?",
					)
					.run(result.reply, conversationKey, messageId);
				this.database.exec("COMMIT");
			} catch (error) {
				this.database.exec("ROLLBACK");
				throw error;
			}
			return { reply: result.reply, replayed: false };
		} finally {
			release();
			if (this.queues.get(conversationKey) === current) this.queues.delete(conversationKey);
		}
	}

	close(): void {
		if (this.queues.size) throw new Error("Cannot close while operations are queued");
		this.database.close();
	}
}
