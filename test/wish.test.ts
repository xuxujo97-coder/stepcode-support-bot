import assert from "node:assert/strict";
import { test } from "node:test";
import { WishAdapter, wishRecordUrl } from "../src/wish.ts";
import type { LarkResourceClient, LarkUserClient, MessageResource } from "../src/lark-client.ts";
import { SupportStateStore } from "../src/state-store.ts";

const RESOURCE_DIR = `${process.cwd()}/lark-im-resources/`;
const INPUT = {
	conversationKey: "k",
	messageId: "om_1",
	description: "希望桌面端支持自定义主题色",
	origin: { chatType: "group" as const, userId: "ou_sender", chatId: "oc_group", threadId: "om_root" },
};

function fixture(responses: unknown[], resources: MessageResource[] | Error = []) {
	const store = new SupportStateStore(":memory:");
	const calls: { command: string; args: string[] }[] = [];
	const client: LarkUserClient & LarkResourceClient = {
		callAsUser: async (command, args) => {
			calls.push({ command, args });
			if (!responses.length) throw new Error("Unexpected API call");
			const response = responses.shift();
			if (response instanceof Error) throw response;
			return response;
		},
		fetchMessageResources: async () => {
			if (resources instanceof Error) throw resources;
			return resources;
		},
	};
	return { store, calls, adapter: new WishAdapter(client, store) };
}

function rowOf(f: { calls: { command: string; args: string[] }[] }): Record<string, unknown> {
	const payload: unknown = JSON.parse(f.calls[0].args[f.calls[0].args.indexOf("--json") + 1]);
	const row = (payload as { create_records: Record<string, unknown>[] }).create_records[0];
	assert.ok(row, "create payload must carry one record");
	return row;
}

test("wishes record the wisher and the verbatim description", async () => {
	const f = fixture([{ record_id_list: ["recnew"] }]);
	try {
		assert.deepEqual(await f.adapter.register(INPUT), { recordId: "recnew", attached: 0 });
		assert.equal(f.calls[0].command, "+record-batch-create");
		assert.equal(f.calls[0].args[f.calls[0].args.indexOf("--base-token") + 1], "VSk7bY3YZaFCkVsHrdzc2CPJnte");
		assert.equal(f.calls[0].args[f.calls[0].args.indexOf("--table-id") + 1], "tblN3eSdrbQx7gaR");
		const row = rowOf(f);
		assert.equal(row.fldx2V8XrT, "希望桌面端支持自定义主题色");
		assert.deepEqual(row.fldDHBw6Rt, ["ou_sender"]);
		assert.equal("PM评估" in row, false);
		assert.equal(f.store.ownsFeedback("recnew", "k"), true);
	} finally {
		f.store.close();
	}
});

test("wish attachments are uploaded and resource markers are stripped", async () => {
	const f = fixture(
		[{ record_id_list: ["recnew"] }, { uploaded: true }],
		[{ messageId: "om_1", key: "img_v3_a", type: "image", localPath: `${RESOURCE_DIR}a.png` }],
	);
	try {
		const result = await f.adapter.register({ ...INPUT, description: "希望支持深色模式 ![Image](img_v3_x)" });
		assert.equal(result.attached, 1);
		assert.equal(rowOf(f).fldx2V8XrT, "希望支持深色模式");
		const upload = f.calls[1];
		assert.equal(upload.command, "+record-upload-attachment");
		assert.equal(upload.args[upload.args.indexOf("--field-id") + 1], "附件");
	} finally {
		f.store.close();
	}
});

test("invalid input and ignored fields never establish ownership", async () => {
	for (const input of [
		{ ...INPUT, description: "" },
		{ ...INPUT, messageId: "not-om" },
		{ ...INPUT, origin: { ...INPUT.origin, userId: "not-ou" } },
	]) {
		const f = fixture([]);
		try {
			await assert.rejects(f.adapter.register(input));
			assert.equal(f.calls.length, 0);
		} finally {
			f.store.close();
		}
	}
	const f = fixture([{ record_id_list: ["recnew"], ignored_fields: ["fldDHBw6Rt"] }]);
	try {
		await assert.rejects(f.adapter.register(INPUT));
		assert.equal(f.store.ownsFeedback("recnew", "k"), false);
	} finally {
		f.store.close();
	}
});

test("record link points at the wish view with the record id", () => {
	assert.equal(
		wishRecordUrl("rec1"),
		"https://wvixbzgc0u7.feishu.cn/base/VSk7bY3YZaFCkVsHrdzc2CPJnte?table=tblN3eSdrbQx7gaR&view=vewHIq55y6&record=rec1",
	);
});
