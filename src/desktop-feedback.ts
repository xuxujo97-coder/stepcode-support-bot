import { attachMessageResources, stripResourceMarkers } from "./attachments.ts";
import { confirmWrite } from "./feedback.ts";
import type { LarkResourceClient, LarkUserClient } from "./lark-client.ts";
import type { SupportStateStore } from "./state-store.ts";

const DESKTOP_BASE = "AHFBbTHaZagfwmsOkYxcte5Znvh";
const DESKTOP_TABLE = "tblRYcDV2jNh53iT";
const DESKTOP_VIEW = "vewaYKrloK";

// Field IDs of the desktop feedback table. They are NOT interchangeable with the main feedback
// table: fld28TIJH7 is the reporter (user) field here, and options on this table are sparser.
const FIELDS = {
	/** 功能描述：the reporter's own description, synced verbatim. */
	description: "fldL0R4T1J",
	/** 反馈时间 */
	time: "fldjaOwVWg",
	/** 反馈来源 */
	source: "fldfm4RNk7",
	/** 反馈人员 */
	reporter: "fld28TIJH7",
	/** Dev 负责人 */
	devOwner: "fldKAu8CpU",
	/** 备注 */
	note: "fld9GvNswG",
	/** 处理状态 */
	status: "fldgN635Un",
	/** 附件 */
	attachment: "附件",
} as const;

/**
 * An assignment note such as "@龙永深（ZouR-Ma）处理中" or "@周旭 跟进" anywhere in the message
 * assigns the Dev owner and the status. Follow-up verbs (处理中/跟进/修复/排查/…) map to 处理中,
 * completed verbs (已处理/已修复/已完成/已解决) to 已完成. The verb must not run into another
 * letter or digit, so words like 处理中断 or 处理中文 never trigger; a verb without a resolvable
 * mention only sets the status. The note is stripped only when the verb sits close behind the
 * mention without sentence punctuation in between.
 */
const ASSIGNMENT_VERB = "已处理|已修复|已完成|已解决|处理中|跟进中|修复中|开发中|排查中|跟进|处理|修复|排查|排期";
const ASSIGNMENT_STATUS = new RegExp(`(${ASSIGNMENT_VERB})(?![\\p{L}\\p{N}])`, "u");
// Strips only a compact note: @<name with optional （…） alias> immediately followed by the verb.
const ASSIGNMENT_STRIP = new RegExp(
	`[（(]?\\s*@[\\p{L}\\p{N}_\\-]{1,30}(?:（[^）]{0,30}）|\\([^)]{0,30}\\))?\\s*(?:${ASSIGNMENT_VERB})(?![\\p{L}\\p{N}])\\s*[）)]?`,
	"gu",
);
const COMPLETED_VERBS = new Set(["已处理", "已修复", "已完成", "已解决"]);

export function desktopRecordUrl(recordId: string): string {
	return `https://wvixbzgc0u7.feishu.cn/base/${DESKTOP_BASE}?table=${DESKTOP_TABLE}&view=${DESKTOP_VIEW}&record=${recordId}`;
}

export interface DesktopFeedbackInput {
	conversationKey: string;
	messageId: string;
	description: string;
	origin: { chatType: "p2p" | "group"; userId: string; chatId: string; threadId?: string };
	mentions: { id: string; name: string }[];
}

/** null means the record exists but its attachments could not be synced from the message. */
export interface DesktopFeedbackResult {
	recordId: string;
	attached: number | null;
	status: string;
	/** The note written to the record, so callers can append follow-up markers. */
	note: string;
	assigned?: { id: string; name: string };
}

export class DesktopFeedbackAdapter {
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

	register(input: DesktopFeedbackInput): Promise<DesktopFeedbackResult> {
		return this.serial(async () => {
			if (!input.conversationKey || !/^om_[A-Za-z0-9_-]+$/u.test(input.messageId)) {
				throw new Error("Invalid desktop feedback context");
			}
			if (!input.description || input.description.length > 4000) {
				throw new Error("Invalid desktop feedback description");
			}
			if (
				(input.origin.chatType !== "p2p" && input.origin.chatType !== "group") ||
				!/^ou_[A-Za-z0-9_-]+$/u.test(input.origin.userId) ||
				!/^oc_[A-Za-z0-9_-]+$/u.test(input.origin.chatId) ||
				!Array.isArray(input.mentions) ||
				input.mentions.some((mention) => !/^ou_[A-Za-z0-9_-]+$/u.test(mention?.id ?? ""))
			) {
				throw new Error("Invalid desktop feedback origin");
			}
			const note = ASSIGNMENT_STATUS.exec(input.description);
			const status = note ? (COMPLETED_VERBS.has(note[1] ?? "") ? "已完成" : "处理中") : "未处理";
			const assigned = note && input.mentions.length > 0 ? input.mentions[0] : undefined;
			let description = input.description;
			if (assigned)
				description = description
					.replace(ASSIGNMENT_STRIP, " ")
					.replace(/([，,])\s*[，,]+/gu, "$1")
					.replace(/\s{2,}/gu, " ")
					.trim();
			const noteText = `桌面端｜chat=${input.origin.chatId}${
				input.origin.threadId ? `｜thread=${input.origin.threadId}` : ""
			}｜message=${input.messageId}${
				note && !assigned ? "｜文末标注了处理状态但未识别到成员，请在表格手动指派 Dev 负责人" : ""
			}`;
			const fields: Record<string, string | string[]> = {
				[FIELDS.description]: stripResourceMarkers(description),
				[FIELDS.source]: [input.origin.chatType === "group" ? "Step Code 群" : "其他"],
				[FIELDS.reporter]: [input.origin.userId],
				[FIELDS.note]: noteText,
				[FIELDS.status]: [status],
				[FIELDS.time]: new Date().toISOString(),
			};
			if (assigned) fields[FIELDS.devOwner] = [assigned.id];
			const result = confirmWrite(
				await this.client.callAsUser("+record-batch-create", [
					"--base-token",
					DESKTOP_BASE,
					"--table-id",
					DESKTOP_TABLE,
					"--json",
					JSON.stringify({ create_records: [fields] }),
				]),
			);
			const ids = result.record_id_list;
			if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== "string" || !ids[0].startsWith("rec")) {
				throw new Error("Desktop feedback creation did not return one record ID");
			}
			this.store.rememberFeedbackOwner(ids[0], input.conversationKey);
			// The record exists; syncing its screenshots is best-effort and reported to the reporter.
			const attached = await attachMessageResources(this.client, {
				base: DESKTOP_BASE,
				table: DESKTOP_TABLE,
				recordId: ids[0],
				fieldId: FIELDS.attachment,
				messageId: input.messageId,
			});
			return {
				recordId: ids[0],
				attached,
				status,
				note: noteText,
				...(assigned ? { assigned } : {}),
			};
		});
	}

	/**
	 * Active reports for duplicate detection: not yet completed and not already merged as duplicates.
	 * Reads at most the first page (200 records); descriptions are capped by the caller.
	 */
	async listActiveReports(excludeRecordId?: string): Promise<{ recordId: string; description: string }[]> {
		const value = (await this.client.callAsUser("+record-list", [
			"--base-token",
			DESKTOP_BASE,
			"--table-id",
			DESKTOP_TABLE,
			"--limit",
			"200",
		])) as { record_id_list?: unknown; fields?: unknown; data?: unknown } | null;
		const ids = Array.isArray(value?.record_id_list) ? value?.record_id_list : [];
		const names = Array.isArray(value?.fields) ? value?.fields : [];
		const rows = Array.isArray(value?.data) ? value?.data : [];
		// record-list reports column NAMES, not field IDs.
		const descriptionIndex = names.indexOf("功能描述");
		const statusIndex = names.indexOf("处理状态");
		const result: { recordId: string; description: string }[] = [];
		for (let index = 0; index < ids.length; index++) {
			const id = ids[index];
			const row = rows[index];
			if (typeof id !== "string" || !Array.isArray(row) || id === excludeRecordId) continue;
			const description = row[descriptionIndex];
			const status = row[statusIndex];
			if (typeof description !== "string" || !description.trim()) continue;
			if (Array.isArray(status) && (status.includes("已完成") || status.includes("重复"))) continue;
			result.push({ recordId: id, description });
		}
		return result;
	}

	/** Appends a suspected-duplicate marker to the new record's note; never merges or rewrites. */
	async flagSuspectedDuplicate(recordId: string, note: string): Promise<void> {
		if (!/^rec[A-Za-z0-9]+$/u.test(recordId) || !note || note.length > 400) {
			throw new Error("Invalid duplicate flag");
		}
		const result = confirmWrite(
			await this.client.callAsUser("+record-batch-update", [
				"--base-token",
				DESKTOP_BASE,
				"--table-id",
				DESKTOP_TABLE,
				"--json",
				JSON.stringify({ update_records: [{ record_id: recordId, fields: { [FIELDS.note]: note } }] }),
			]),
		);
		if (!Array.isArray(result.record_id_list) || !result.record_id_list.includes(recordId)) {
			throw new Error("Duplicate flag was not applied");
		}
	}
}
