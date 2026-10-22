import type { CommandActions } from "./commands.ts";
import type { LarkClient } from "./lark-client.ts";
import type { SupportStateStore } from "./state-store.ts";

const BASE = "JISWbYrAKaDyUesgozScKAHwnfg";
const TABLE = "tbllVrVKAZ3EEv8Y";
const ID_FIELD = "fldeAklAtM";

export function confirmWrite(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid feedback write response");
	if (
		"ignored_fields" in value &&
		value.ignored_fields !== null &&
		(!Array.isArray(value.ignored_fields) || value.ignored_fields.length > 0)
	)
		throw new Error("Feedback fields were ignored");
	return value as Record<string, unknown>;
}

export class FeedbackAdapter {
	private readonly client: LarkClient;
	private readonly store: SupportStateStore;
	private queue: Promise<void> = Promise.resolve();

	constructor(client: LarkClient, store: SupportStateStore) {
		this.client = client;
		this.store = store;
	}

	private async serial<T>(work: () => Promise<T>): Promise<T> {
		const previous = this.queue;
		let release = () => {};
		this.queue = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			return await work();
		} finally {
			release();
		}
	}

	registerFeedback(input: Parameters<CommandActions["registerFeedback"]>[0]): Promise<{ recordId: string }> {
		return this.serial(async () => {
			if (
				!input.conversationKey ||
				!input.messageId ||
				!input.description ||
				input.description.length > 4000 ||
				(input.kind !== "Bug" && input.kind !== "Feature")
			)
				throw new Error("Invalid admitted feedback");
			const fields: Record<string, string | string[]> = {
				fld28TIJH7: [input.kind],
				fldWxIPNbI: input.description,
				fldL0R4T1J: input.description.slice(0, 120),
				fldgN635Un: ["待审核"],
				fldm5vVswr: [input.kind === "Bug" ? "待复现" : "不适用"],
				fldTsku0wF: ["待定"],
				fldfm4RNk7: ["其他"],
				fldjaOwVWg: new Date().toISOString(),
			};
			// Client-generated ID supplied by the user in the description; the bot never creates one.
			if (input.feedbackId) fields[ID_FIELD] = input.feedbackId;
			const result = confirmWrite(
				await this.client.call("+record-batch-create", [
					"--base-token",
					BASE,
					"--table-id",
					TABLE,
					"--json",
					JSON.stringify({ create_records: [fields] }),
				]),
			);
			const ids = result.record_id_list;
			if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== "string" || !ids[0].startsWith("rec")) {
				throw new Error("Feedback creation did not return one record ID");
			}
			this.store.rememberFeedbackOwner(ids[0], input.conversationKey);
			return { recordId: ids[0] };
		});
	}
}
