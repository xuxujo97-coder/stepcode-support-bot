import { unlink } from "node:fs/promises";
import { confirmWrite } from "./feedback.ts";
import type { LarkResourceClient, LarkUserClient } from "./lark-client.ts";
import type { SupportStateStore } from "./state-store.ts";

const DESKTOP_BASE = "WEqObQt9GaG4PisMdcFcmFcfnfc";
const DESKTOP_TABLE = "tbl72m5Wwm2al9Sv";
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

/** The CLI renders embedded resources as inline markers; the binaries land in the attachment cell. */
const RESOURCE_MARKER = /!\[Image\]\([^)]*\)|\[图片\]/gu;

/**
 * A trailing assignment note such as "@龙永深（ZouR-Ma）处理中" assigns the Dev owner and the
 * status; a status word without a resolvable mention only sets the status.
 */
const ASSIGNMENT_NOTE = /(处理中|已处理)\s*$/u;
const ASSIGNMENT_STRIP = /@.{1,100}?\s*(?:处理中|已处理)\s*$/u;

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
			const note = ASSIGNMENT_NOTE.exec(input.description);
			const status = note ? (note[1] === "已处理" ? "已完成" : "处理中") : "未处理";
			const assigned = note && input.mentions.length > 0 ? input.mentions[0] : undefined;
			let description = input.description;
			if (assigned) description = description.replace(ASSIGNMENT_STRIP, "").trimEnd();
			const fields: Record<string, string | string[]> = {
				[FIELDS.description]: description
					.replace(RESOURCE_MARKER, " ")
					.replace(/\s{2,}/gu, " ")
					.trim(),
				[FIELDS.source]: [input.origin.chatType === "group" ? "Step Code 群" : "其他"],
				[FIELDS.reporter]: [input.origin.userId],
				[FIELDS.note]: `桌面端｜chat=${input.origin.chatId}${
					input.origin.threadId ? `｜thread=${input.origin.threadId}` : ""
				}｜message=${input.messageId}${
					note && !assigned ? "｜文末标注了处理状态但未识别到成员，请在表格手动指派 Dev 负责人" : ""
				}`,
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
			const attached = await this.attachMessageResources(ids[0], input.messageId);
			return { recordId: ids[0], attached, status, ...(assigned ? { assigned } : {}) };
		});
	}

	/** Returns the number of uploaded resources, null when nothing could be synced. */
	private async attachMessageResources(recordId: string, messageId: string): Promise<number | null> {
		let resources;
		try {
			resources = await this.client.fetchMessageResources(messageId);
		} catch {
			return null;
		}
		if (resources.length === 0) return 0;
		try {
			await this.client.callAsUser("+record-upload-attachment", [
				"--base-token",
				DESKTOP_BASE,
				"--table-id",
				DESKTOP_TABLE,
				"--record-id",
				recordId,
				"--field-id",
				FIELDS.attachment,
				...resources.flatMap((resource) => ["--file", resource.localPath]),
			]);
		} catch {
			return null;
		} finally {
			await Promise.allSettled(resources.map((resource) => unlink(resource.localPath)));
		}
		return resources.length;
	}
}
