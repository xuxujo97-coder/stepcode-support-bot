import { unlink } from "node:fs/promises";
import type { LarkResourceClient, LarkUserClient } from "./lark-client.ts";

/** The CLI renders embedded resources as inline markers; the binaries land in the attachment cell. */
const RESOURCE_MARKER = /!\[Image\]\([^)]*\)|\[图片\]/gu;

export function stripResourceMarkers(text: string): string {
	return text
		.replace(RESOURCE_MARKER, " ")
		.replace(/\s{2,}/gu, " ")
		.trim();
}

/**
 * Best-effort attachment sync from one message into one attachment cell: downloads the message's
 * own resources and uploads them. Returns the uploaded count, 0 when the message carries none,
 * or null when nothing could be synced; downloaded files are always cleaned up.
 */
export async function attachMessageResources(
	client: LarkUserClient & LarkResourceClient,
	target: { base: string; table: string; recordId: string; fieldId: string; messageId: string },
): Promise<number | null> {
	let resources;
	try {
		resources = await client.fetchMessageResources(target.messageId);
	} catch {
		return null;
	}
	if (resources.length === 0) return 0;
	try {
		await client.callAsUser("+record-upload-attachment", [
			"--base-token",
			target.base,
			"--table-id",
			target.table,
			"--record-id",
			target.recordId,
			"--field-id",
			target.fieldId,
			...resources.flatMap((resource) => ["--file", resource.localPath]),
		]);
	} catch {
		return null;
	} finally {
		await Promise.allSettled(resources.map((resource) => unlink(resource.localPath)));
	}
	return resources.length;
}
