import assert from "node:assert/strict";
import { test } from "node:test";
import { SupportHost, type SupportHostActions, type SupportMessage } from "../src/host.ts";
import { SupportStateStore } from "../src/state-store.ts";

const message: SupportMessage = { tenantId: "tenant", chatType: "p2p", userId: "user", chatId: "chat", messageId: "1", text: "/help" };

function fixture() {
	const store = new SupportStateStore(":memory:");
	const calls: string[] = [];
	const actions: SupportHostActions = {
		admit: async () => true,
		resetContext: async () => { calls.push("reset"); },
		status: async () => "offline",
		registerFeedback: async () => { calls.push("register"); return { recordId: "record" }; },
		answer: async (_text, context) => { calls.push(`answer:${context.state.feedback?.recordId ?? ""}`); return "answer"; },
	};
	return { store, calls, actions, host: new SupportHost(store, actions) };
}

test("host commits command state and routes ordinary questions without invoking feedback", async () => {
	const f = fixture();
	try {
		await f.host.handle({ ...message, text: "/bug Step Code crash" });
		assert.equal((await f.host.handle({ ...message, messageId: "2", text: "Step Code crash?" }))?.reply, "answer");
		await f.host.handle({ ...message, messageId: "3", text: "/unknown" });
		// Committed feedback state reaches the next question; unknown commands invoke nothing.
		assert.deepEqual(f.calls, ["register", "answer:record"]);
	} finally { f.store.close(); }
});

test("feedback replay writes once and another user's state stays separate", async () => {
	const f = fixture();
	try {
		const input = { ...message, text: "/bug Step Code crash\nFeedback ID：fb-1" };
		await f.host.handle(input);
		assert.equal((await f.host.handle(input))?.replayed, true);
		await f.host.handle({ ...message, userId: "other", messageId: "2", text: "Step Code question" });
		assert.deepEqual(f.calls, ["register", "answer:"]);
	} finally { f.store.close(); }
});

test("admission runs before commands and duplicate replays", async () => {
	const f = fixture();
	try {
		await f.host.handle(message);
		f.actions.admit = async () => false;
		assert.equal(await f.host.handle(message), undefined);
		assert.equal(await f.host.handle({ ...message, text: "/bug unrelated private input" }), undefined);
		assert.deepEqual(f.calls, []);
	} finally { f.store.close(); }
});

test("scope encoding cannot collide through separators", async () => {
	const f = fixture();
	try {
		await f.host.handle({ ...message, tenantId: "a:b", userId: "c", text: "/bug Step Code crash" });
		await f.host.handle({ ...message, messageId: "2", tenantId: "a", userId: "b:c", text: "Step Code question" });
		assert.deepEqual(f.calls, ["register", "answer:"]);
	} finally { f.store.close(); }
});

test("invalid identities and oversized input cannot invoke actions", async () => {
	const f = fixture();
	try {
		for (const invalid of [{ userId: "" }, { threadId: "" }, { threadId: "a".repeat(257) }, { text: "a".repeat(8001) }]) {
			await assert.rejects(f.host.handle({ ...message, ...invalid }));
		}
		assert.deepEqual(f.calls, []);
	} finally { f.store.close(); }
});

test("/feedback pointer completes normally and does not block following questions", async () => {
	const f = fixture();
	try {
		const input = { ...message, text: "/feedback id real" };
		assert.match((await f.host.handle(input))?.reply ?? "", /Step Code 客户端里的命令/);
		assert.equal((await f.host.handle(input))?.replayed, true);
		assert.equal((await f.host.handle({ ...message, messageId: "2", text: "Step Code question" }))?.reply, "answer");
		assert.deepEqual(f.calls, ["answer:"]);
	} finally { f.store.close(); }
});

test("triage messages route through the triage action and silence on undefined", async () => {
	const f = fixture();
	try {
		const seen: { text: string; reply?: string }[] = [];
		f.actions.triage = async (text) => {
			seen.push({ text });
			return text.includes("白屏") ? "自动识别为桌面端问题，已记录" : undefined;
		};
		const routed = await f.host.handle({
			...message,
			chatType: "group",
			chatId: "oc_group",
			threadId: "om_root",
			triage: true,
			text: "桌面端白屏了",
		});
		assert.equal(routed?.reply, "自动识别为桌面端问题，已记录");
		assert.equal(routed?.replayed, false);
		const silent = await f.host.handle({
			...message,
			chatType: "group",
			chatId: "oc_group",
			threadId: "om_root2",
			messageId: "2",
			triage: true,
			text: "今天天气不错",
		});
		assert.equal(silent?.reply, "");
		// Sensitive unprompted messages stay silent too.
		const sensitive = await f.host.handle({
			...message,
			chatType: "group",
			chatId: "oc_group",
			threadId: "om_root3",
			messageId: "3",
			triage: true,
			text: "api_key=secret-value-123",
		});
		assert.equal(sensitive?.reply, "");
		assert.deepEqual(seen, [{ text: "桌面端白屏了" }, { text: "今天天气不错" }]);
	} finally {
		f.store.close();
	}
});
