import { attachMessageResources, stripResourceMarkers } from "./attachments.ts";
import { confirmWrite } from "./feedback.ts";
import type { LarkResourceClient, LarkUserClient } from "./lark-client.ts";
import type { SupportStateStore } from "./state-store.ts";

const WISH_BASE = "VSk7bY3YZaFCkVsHrdzc2CPJnte";
const WISH_TABLE = "tblN3eSdrbQx7gaR";
const WISH_VIEW = "vewHIq55y6";

const FIELDS = {
	/** 愿望描述 */
	description: "fldx2V8XrT",
	/** 许愿人 */
	wisher: "fldDHBw6Rt",
	/** 附件 */
	attachment: "附件",
} as const;

export function wishRecordUrl(recordId: string): string {
	return `https://wvixbzgc0u7.feishu.cn/base/${WISH_BASE}?table=${WISH_TABLE}&view=${WISH_VIEW}&record=${recordId}`;
}

export interface WishInput {
	conversationKey: string;
	messageId: string;
	description: string;
	origin: { chatType: "p2p" | "group"; userId: string; chatId: string; threadId?: string };
}

/** null means the record exists but its attachments could not be synced from the message. */
export interface WishResult {
	recordId: string;
	attached: number | null;
}

/** Records feature wishes: wisher, verbatim description and the message's attachments. */
export class WishAdapter {
	private readonly client: LarkUserClient & LarkResourceClient;
	private readonly store: SupportStateStore;
	private queue: Promise<void> = Promise.resolve();

	constructor(client: LarkUserClient & LarkResourceClient, store: SupportStateStore) {
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

	register(input: WishInput): Promise<WishResult> {
		return this.serial(async () => {
			if (!input.conversationKey || !/^om_[A-Za-z0-9_-]+$/u.test(input.messageId)) {
				throw new Error("Invalid wish context");
			}
			if (!input.description || input.description.length > 4000) {
				throw new Error("Invalid wish description");
			}
			if (
				(input.origin.chatType !== "p2p" && input.origin.chatType !== "group") ||
				!/^ou_[A-Za-z0-9_-]+$/u.test(input.origin.userId) ||
				!/^oc_[A-Za-z0-9_-]+$/u.test(input.origin.chatId)
			) {
				throw new Error("Invalid wish origin");
			}
			const fields: Record<string, string | string[]> = {
				[FIELDS.description]: stripResourceMarkers(input.description),
				[FIELDS.wisher]: [input.origin.userId],
			};
			const result = confirmWrite(
				await this.client.callAsUser("+record-batch-create", [
					"--base-token",
					WISH_BASE,
					"--table-id",
					WISH_TABLE,
					"--json",
					JSON.stringify({ create_records: [fields] }),
				]),
			);
			const ids = result.record_id_list;
			if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== "string" || !ids[0].startsWith("rec")) {
				throw new Error("Wish creation did not return one record ID");
			}
			this.store.rememberFeedbackOwner(ids[0], input.conversationKey);
			// The record exists; syncing its screenshots is best-effort and reported to the wisher.
			const attached = await attachMessageResources(this.client, {
				base: WISH_BASE,
				table: WISH_TABLE,
				recordId: ids[0],
				fieldId: FIELDS.attachment,
				messageId: input.messageId,
			});
			return { recordId: ids[0], attached };
		});
	}
}
