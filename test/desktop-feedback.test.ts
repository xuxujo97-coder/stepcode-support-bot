import assert from "node:assert/strict";
import { test } from "node:test";
import { DesktopFeedbackAdapter, desktopRecordUrl } from "../src/desktop-feedback.ts";
import type { LarkResourceClient, LarkUserClient, MessageResource } from "../src/lark-client.ts";
import { SupportStateStore } from "../src/state-store.ts";

const INPUT = {
	conversationKey: "k",
	messageId: "om_1",
	description: "设置页打不开，点了没反应",
	origin: { chatType: "group" as const, userId: "ou_sender", chatId: "oc_group", threadId: "om_root" },
};

function fixture(responses: unknown[], resources: MessageResource[] | Error = []) {
	const store = new SupportStateStore(":memory:");
	const calls: { command: string; args: string[] }[] = [];
	const fetches: string[] = [];
	const client: LarkUserClient & LarkResourceClient = {
		callAsUser: async (command, args) => {
			calls.push({ command, args });
			if (!responses.length) throw new Error("Unexpected API call");
			const response = responses.shift();
			if (response instanceof Error) throw response;
			return response;
		},
		fetchMessageResources: async (messageId) => {
			fetches.push(messageId);
			if (resources instanceof Error) throw resources;
			return resources;
		},
	};
	return { store, calls, fetches, adapter: new DesktopFeedbackAdapter(client, store) };
}

const RESOURCE_DIR = `${process.cwd()}/lark-im-resources/`;
const IMAGE: MessageResource = { messageId: "om_1", key: "img_v3_a", type: "image", localPath: `${RESOURCE_DIR}a.png` };
const LOG_FILE: MessageResource = { messageId: "om_1", key: "file_v3_b", type: "file", localPath: `${RESOURCE_DIR}b.log` };

function rowOf(f: { calls: { command: string; args: string[] }[] }): Record<string, unknown> {
	const payload: unknown = JSON.parse(f.calls[0].args[f.calls[0].args.indexOf("--json") + 1]);
	const row = (payload as { create_records: Record<string, unknown>[] }).create_records[0];
	assert.ok(row, "create payload must carry one record");
	return row;
}

test("group reports map onto the desktop table through the operator user identity", async () => {
	const f = fixture([{ record_id_list: ["rec-new"] }]);
	try {
		assert.deepEqual(await f.adapter.register(INPUT), { recordId: "rec-new", attached: 0 });
		assert.equal(f.calls[0].command, "+record-batch-create");
		assert.equal(f.calls[0].args[f.calls[0].args.indexOf("--base-token") + 1], "WEqObQt9GaG4PisMdcFcmFcfnfc");
		assert.equal(f.calls[0].args[f.calls[0].args.indexOf("--table-id") + 1], "tbl72m5Wwm2al9Sv");
		const row = rowOf(f);
		assert.equal(row.fldL0R4T1J, "设置页打不开，点了没反应");
		assert.deepEqual(row.fldfm4RNk7, ["Step Code 群"]);
		assert.deepEqual(row.fld28TIJH7, ["ou_sender"]);
		assert.deepEqual(row.fldgN635Un, ["未处理"]);
		assert.equal(row.fld9GvNswG, "桌面端｜chat=oc_group｜thread=om_root｜message=om_1");
		assert.ok(typeof row.fldjaOwVWg === "string" && Number.isFinite(Date.parse(row.fldjaOwVWg)));
		assert.equal(f.store.ownsFeedback("rec-new", "k"), true);
		assert.deepEqual(f.fetches, ["om_1"]);
		assert.equal(f.calls.length, 1);
	} finally {
		f.store.close();
	}
});

test("message resources are uploaded to the attachment cell and reported", async () => {
	const f = fixture([{ record_id_list: ["rec-new"] }, { uploaded: true }], [IMAGE, LOG_FILE]);
	try {
		const result = await f.adapter.register(INPUT);
		assert.equal(result.attached, 2);
		const upload = f.calls[1];
		assert.equal(upload.command, "+record-upload-attachment");
		assert.equal(upload.args[upload.args.indexOf("--record-id") + 1], "rec-new");
		assert.equal(upload.args[upload.args.indexOf("--field-id") + 1], "附件");
		const files: string[] = [];
		for (let i = 0; i < upload.args.length - 1; i++)
			if (upload.args[i] === "--file") files.push(upload.args[i + 1]);
		assert.deepEqual(files, [`${RESOURCE_DIR}a.png`, `${RESOURCE_DIR}b.log`]);
	} finally {
		f.store.close();
	}
});

test("resource marker artifacts are stripped from the description", async () => {
	const f = fixture([{ record_id_list: ["rec-new"] }]);
	try {
		await f.adapter.register({ ...INPUT, description: "桌面端白屏 ![Image](img_v3_x)[图片]" });
		assert.equal(rowOf(f).fldL0R4T1J, "桌面端白屏");
	} finally {
		f.store.close();
	}
});

test("private reports use the other source and carry no thread in the note", async () => {
	const f = fixture([{ record_id_list: ["rec-new"] }]);
	try {
		const result = await f.adapter.register({
			...INPUT,
			origin: { chatType: "p2p", userId: "ou_sender", chatId: "oc_p2p" },
		});
		assert.equal(result.attached, 0);
		const row = rowOf(f);
		assert.deepEqual(row.fldfm4RNk7, ["其他"]);
		assert.equal(row.fld9GvNswG, "桌面端｜chat=oc_p2p｜message=om_1");
	} finally {
		f.store.close();
	}
});

test("attachment sync failures never fail the created record", async () => {
	for (const resources of [new Error("mget failed"), [IMAGE]] as (MessageResource[] | Error)[]) {
		const f = fixture([{ record_id_list: ["rec-new"] }, new Error("upload failed")], resources);
		try {
			const result = await f.adapter.register(INPUT);
			assert.equal(result.recordId, "rec-new");
			assert.equal(result.attached, null);
			assert.equal(f.store.ownsFeedback("rec-new", "k"), true);
		} finally {
			f.store.close();
		}
	}
});

test("invalid input and ignored fields never establish ownership", async () => {
	const invalid = [
		{ ...INPUT, description: "" },
		{ ...INPUT, messageId: "not-om" },
		{ ...INPUT, origin: { ...INPUT.origin, userId: "not-ou" } },
	];
	for (const input of invalid) {
		const f = fixture([]);
		try {
			await assert.rejects(f.adapter.register(input));
			assert.equal(f.calls.length, 0);
		} finally {
			f.store.close();
		}
	}
	for (const response of [
		{ record_id_list: ["rec-new"], ignored_fields: ["fld28TIJH7"] },
		{ record_id_list: [] },
		{ record_id_list: ["rec-a", "rec-b"] },
	]) {
		const f = fixture([response]);
		try {
			await assert.rejects(f.adapter.register(INPUT));
			assert.equal(f.store.ownsFeedback("rec-new", "k"), false);
		} finally {
			f.store.close();
		}
	}
});

test("record link points at the desktop view with the record id", () => {
	assert.equal(
		desktopRecordUrl("rec1"),
		"https://wvixbzgc0u7.feishu.cn/base/WEqObQt9GaG4PisMdcFcmFcfnfc?table=tbl72m5Wwm2al9Sv&view=vewaYKrloK&record=rec1",
	);
});
