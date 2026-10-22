import assert from "node:assert/strict";
import { test } from "node:test";
import { FeedbackAdapter } from "../src/feedback.ts";
import type { LarkClient } from "../src/lark-client.ts";
import { SupportStateStore } from "../src/state-store.ts";

const ID = "fldeAklAtM";
function matrix(ids: string[], cells: (string | null)[], hasMore = false) {
	return { record_id_list: ids, field_id_list: [ID], data: cells.map((cell) => [cell]), has_more: hasMore, rev: 1 };
}

function fixture(responses: unknown[]) {
	const store = new SupportStateStore(":memory:");
	const calls: { command: string; args: string[] }[] = [];
	const client: LarkClient = {
		call: async (command, args) => {
			calls.push({ command, args });
			if (!responses.length) throw new Error("Unexpected API call");
			const response = responses.shift();
			if (response instanceof Error) throw response;
			return response;
		},
	};
	return { store, calls, adapter: new FeedbackAdapter(client, store) };
}

test("registration uses actual field IDs and defaults without generating client IDs or assigning owners", async () => {
	for (const kind of ["Bug", "Feature"] as const) {
		const f = fixture([{ record_id_list: ["rec-own"] }]);
		try {
			assert.deepEqual(await f.adapter.registerFeedback({ conversationKey: "a", messageId: "1", kind, description: "Step Code crash" }), { recordId: "rec-own" });
			assert.equal(f.store.ownsFeedback("rec-own", "a"), true);
			const payload: unknown = JSON.parse(f.calls[0].args[f.calls[0].args.indexOf("--json") + 1]);
			assert.deepEqual(payload, { create_records: [{
				fld28TIJH7: [kind], fldWxIPNbI: "Step Code crash", fldL0R4T1J: "Step Code crash",
				fldgN635Un: ["待审核"], fldm5vVswr: [kind === "Bug" ? "待复现" : "不适用"],
				fldTsku0wF: ["待定"], fldfm4RNk7: ["其他"], fldjaOwVWg: assertDate(payload),
			}] });
		} finally { f.store.close(); }
	}
});

function assertDate(payload: unknown): string {
	assert.ok(payload && typeof payload === "object" && "create_records" in payload && Array.isArray(payload.create_records));
	const row: unknown = payload.create_records[0];
	assert.ok(row && typeof row === "object" && "fldjaOwVWg" in row && typeof row.fldjaOwVWg === "string");
	assert.ok(Number.isFinite(Date.parse(row.fldjaOwVWg)));
	return row.fldjaOwVWg;
}

test("a user-supplied client Feedback ID is written to the ID field unchanged", async () => {
	const f = fixture([{ record_id_list: ["rec-own"] }]);
	try {
		await f.adapter.registerFeedback({ conversationKey: "a", messageId: "1", kind: "Bug", description: "Step Code crash", feedbackId: "Actual_Client_ID-123" });
		const payload = JSON.parse(f.calls[0].args[f.calls[0].args.indexOf("--json") + 1]);
		assert.equal(payload.create_records[0][ID], "Actual_Client_ID-123");
	} finally { f.store.close(); }
});

test("ignored create fields and ambiguous responses never establish ownership", async () => {
	for (const response of [{ record_id_list: ["rec-own"], ignored_fields: ["field"] }, { record_id_list: [] }, { record_id_list: ["rec-a", "rec-b"] }]) {
		const f = fixture([response]);
		try {
			await assert.rejects(f.adapter.registerFeedback({ conversationKey: "a", messageId: "1", kind: "Bug", description: "Step Code crash" }));
			assert.equal(f.store.ownsFeedback("rec-own", "a"), false);
		} finally { f.store.close(); }
	}
});
