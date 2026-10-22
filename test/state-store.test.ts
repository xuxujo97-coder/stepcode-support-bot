import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SupportStateStore } from "../src/state-store.ts";

test("completed message replays without repeating work or rolling back newer state", async () => {
	const store = new SupportStateStore(":memory:");
	try {
		await store.execute("a", "1", "input", async () => ({ state: { feedback: { recordId: "r1" } }, reply: "first" }));
		await store.execute("a", "2", "next", async () => ({ state: { feedback: { recordId: "r2" } }, reply: "second" }));
		assert.deepEqual(await store.execute("a", "1", "input", async () => { throw new Error("must not run"); }), {
			reply: "first", replayed: true,
		});
		assert.deepEqual(store.readState("a"), { feedback: { recordId: "r2" } });
		await assert.rejects(store.execute("a", "1", "changed", async () => { throw new Error("must not run"); }), /payload changed/);
	} finally { store.close(); }
});

test("same conversation is serialized while another conversation proceeds independently", async () => {
	const store = new SupportStateStore(":memory:");
	let release = () => {};
	const gate = new Promise<void>((resolve) => { release = resolve; });
	try {
		const first = store.execute("a", "1", "first", async () => {
			await gate;
			return { state: { feedback: { recordId: "own" } }, reply: "first" };
		});
		const second = store.execute("a", "2", "second", async (state) => {
			assert.equal(state.feedback?.recordId, "own");
			return { state: {}, reply: "second" };
		});
		await store.execute("b", "1", "other", async (state) => {
			assert.deepEqual(state, {});
			return { state, reply: "other" };
		});
		assert.throws(() => store.close(), /queued/);
		release();
		await Promise.all([first, second]);
		assert.deepEqual(store.readState("a"), {});
	} finally { release(); store.close(); }
});

test("pending failures survive restart and prevent retries or later writes in that conversation", async () => {
	const directory = mkdtempSync(join(tmpdir(), "support-state-"));
	const path = join(directory, "state.sqlite");
	let store = new SupportStateStore(path);
	try {
		await store.execute("a", "1", "ok", async () => ({ state: { feedback: { recordId: "r1" } }, reply: "saved" }));
		store.rememberFeedbackOwner("rec-owned", "a");
		await assert.rejects(store.execute("a", "2", "write", async () => { throw new Error("unknown remote outcome"); }));
		store.close();
		store = new SupportStateStore(path);
		assert.deepEqual(store.readState("a"), { feedback: { recordId: "r1" } });
		assert.equal(store.ownsFeedback("rec-owned", "a"), true);
		assert.equal(store.ownsFeedback("rec-owned", "b"), false);
		assert.throws(() => store.rememberFeedbackOwner("rec-owned", "b"), /ownership conflict/);
		for (const id of ["2", "3"]) {
			await assert.rejects(store.execute("a", id, "write", async () => { throw new Error("must not retry"); }), /reconciliation/);
		}
		assert.equal((await store.execute("a", "1", "ok", async () => { throw new Error("must not run"); })).replayed, true);
	} finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("concurrent duplicate deliveries invoke work once", async () => {
	const store = new SupportStateStore(":memory:");
	let calls = 0;
	try {
		const work = async () => { calls++; return { state: {}, reply: "ok" }; };
		const results = await Promise.all([store.execute("a", "1", "same", work), store.execute("a", "1", "same", work)]);
		assert.equal(calls, 1);
		assert.deepEqual(results.map((result) => result.replayed), [false, true]);
	} finally { store.close(); }
});
