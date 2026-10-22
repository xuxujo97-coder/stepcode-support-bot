import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { SupportHost, type SupportMessage } from "../src/host.ts";
import { SupportKnowledge } from "../src/knowledge.ts";
import { SupportAnswerer } from "../src/model.ts";
import { SupportStateStore } from "../src/state-store.ts";
import { decodeMessage } from "../src/transport.ts";

const root = resolve(import.meta.dirname, "../../..");
const BOT = "ou_bot";
const GROUP = "oc_group";
const OWNER = "ou_owner";

function groupEvent(overrides: Record<string, unknown> = {}) {
	return {
		type: "im.message.receive_v1",
		chat_type: "group",
		sender_type: "user",
		message_type: "text",
		sender_id: "ou_alice",
		chat_id: GROUP,
		message_id: "om_root",
		content: "@Step Code助手 Step Code 怎么登录",
		mentions: [{ id: BOT, key: "@_user_1", name: "Step Code助手" }],
		...overrides,
	};
}

test("group messages reach the host only when the bot itself is mentioned", () => {
	const addressed = decodeMessage(groupEvent(), "tenant", BOT);
	assert.equal(addressed?.chatType, "group");
	assert.equal(addressed?.text, "Step Code 怎么登录");
	assert.equal(addressed?.threadId, "om_root");
	for (const mentions of [undefined, [], [{ id: "ou_someone", key: "@_user_1", name: "Alice" }]]) {
		assert.equal(decodeMessage(groupEvent({ mentions }), "tenant", BOT), undefined);
	}
	const placeholder = decodeMessage(groupEvent({ content: "@_user_1 /help" }), "tenant", BOT);
	assert.equal(placeholder?.text, "/help");
	assert.equal(decodeMessage(groupEvent({ content: "@Step Code助手" }), "tenant", BOT)?.text, "/help");
});

test("replies with a quote arrive as post and are handled like text", () => {
	// Real topic-group event 2026-10-19: "@Step Code助手 /help" sent as a reply carried message_type post.
	const reply = decodeMessage(
		groupEvent({ message_type: "post", content: "@Step Code助手 /help", root_id: "om_root", message_id: "om_reply" }),
		"tenant",
		BOT,
	);
	assert.equal(reply?.text, "/help");
	assert.equal(reply?.threadId, "om_root");
	assert.equal(decodeMessage(groupEvent({ message_type: "image" }), "tenant", BOT), undefined);
});

test("replies inside a thread share the thread root as context identity", () => {
	const reply = decodeMessage(
		groupEvent({ message_id: "om_second", root_id: "om_root", sender_id: "ou_bob" }),
		"tenant",
		BOT,
	);
	assert.equal(reply?.threadId, "om_root");
	assert.equal(reply?.userId, "ou_bob");
	// A private message never carries a group thread identity.
	const direct = decodeMessage(groupEvent({ chat_type: "p2p", mentions: undefined, content: "hi" }), "tenant", BOT);
	assert.equal(direct?.chatType, "p2p");
	assert.equal(direct?.threadId, undefined);
});

function harness() {
	const store = new SupportStateStore(":memory:");
	const seen: { text: string; previousQuestion: unknown }[] = [];
	const answerer = new SupportAnswerer(
		async (system, input) => {
			if (system.startsWith("Classify")) {
				const request = JSON.parse(input);
				seen.push({ text: request.text, previousQuestion: request.previousQuestion });
				return JSON.stringify({ scope: "related", question: `Q:${request.text}` });
			}
			return '{"answer":"请参考登录说明。","sources":[1],"feedbackKind":"none"}';
		},
		new SupportKnowledge(root),
		store,
		1000,
	);
	const registrations: { conversationKey: string; feedbackId?: string }[] = [];
	const host = new SupportHost(store, {
		admit: async (message) => (message.chatType === "group" ? message.chatId === GROUP : message.userId === OWNER),
		redirect: (message) => (message.chatType === "p2p" && message.userId !== OWNER ? "请在群里 @我" : undefined),
		answer: (text, context) => answerer.answer(text, context),
		resetContext: async (key) => answerer.resetContext(key),
		status: async () => "running",
		registerFeedback: async (input) => {
			registrations.push({ conversationKey: input.conversationKey, feedbackId: input.feedbackId });
			return { recordId: `rec-${registrations.length}` };
		},
	});
	let counter = 0;
	const send = (overrides: Partial<SupportMessage>) =>
		host.handle({
			tenantId: "tenant",
			chatType: "group",
			userId: "ou_alice",
			chatId: GROUP,
			threadId: "om_root",
			messageId: `om_${++counter}`,
			text: "Step Code 怎么登录",
			...overrides,
		});
	return { store, seen, send, registrations };
}

const previousFor = (seen: { text: string; previousQuestion: unknown }[], text: string) =>
	seen.find((item) => item.text === text)?.previousQuestion;

test("people in one thread share follow-up context; other threads and groups do not", async () => {
	const h = harness();
	try {
		await h.send({ userId: "ou_alice", text: "alice asks about login" });
		await h.send({ userId: "ou_bob", text: "bob follows up" });
		assert.equal(previousFor(h.seen, "bob follows up"), "Q:alice asks about login");

		await h.send({ userId: "ou_carol", threadId: "om_other", text: "carol in another thread" });
		assert.equal(previousFor(h.seen, "carol in another thread"), undefined);

		// The owner's private chat never sees group thread context, and vice versa.
		await h.send({ chatType: "p2p", userId: OWNER, chatId: "oc_dm", threadId: undefined, text: "owner private" });
		assert.equal(previousFor(h.seen, "owner private"), undefined);
		await h.send({ userId: "ou_alice", text: "alice continues" });
		assert.equal(previousFor(h.seen, "alice continues"), "Q:bob follows up");

		// A group outside the allowlist gets no reply and runs no model call.
		const before = h.seen.length;
		assert.equal(await h.send({ chatId: "oc_unknown", text: "elsewhere" }), undefined);
		assert.equal(h.seen.length, before);
	} finally {
		h.store.close();
	}
});

test("/new in a thread clears the shared context for every participant", async () => {
	const h = harness();
	try {
		await h.send({ userId: "ou_alice", text: "first" });
		await h.send({ userId: "ou_bob", text: "/new" });
		await h.send({ userId: "ou_alice", text: "after reset" });
		assert.equal(previousFor(h.seen, "after reset"), undefined);
	} finally {
		h.store.close();
	}
});

test("feedback records stay owned per person even inside a shared thread", async () => {
	const h = harness();
	try {
		await h.send({ userId: "ou_alice", text: "/bug Step Code login fails" });
		assert.equal(h.registrations.length, 1);
		await h.send({ userId: "ou_bob", text: "/bug Step Code login fails too\nFeedback ID：fb-bob" });
		assert.equal(h.registrations.length, 2);
		assert.equal(h.registrations[1].feedbackId, "fb-bob");
		assert.notEqual(h.registrations[0].conversationKey, h.registrations[1].conversationKey);
	} finally {
		h.store.close();
	}
});

test("private chat is open to the owner; others get a fixed redirect without any processing", async () => {
	const h = harness();
	try {
		const stranger = await h.send({ chatType: "p2p", userId: "ou_stranger", chatId: "oc_dm2", threadId: undefined });
		assert.equal(stranger?.reply, "请在群里 @我");
		assert.equal(h.seen.length, 0);
		const owner = await h.send({ chatType: "p2p", userId: OWNER, chatId: "oc_dm", threadId: undefined });
		assert.match(owner?.reply ?? "", /来源/u);
		assert.equal(h.seen.length, 1);
	} finally {
		h.store.close();
	}
});

test("concurrent questions from different threads never leak into each other's model input", async () => {
	const h = harness();
	try {
		await Promise.all([
			h.send({ userId: "ou_alice", threadId: "om_a", text: "a-1" }),
			h.send({ userId: "ou_bob", threadId: "om_b", text: "b-1" }),
		]);
		await Promise.all([
			h.send({ userId: "ou_alice", threadId: "om_a", text: "a-2" }),
			h.send({ userId: "ou_bob", threadId: "om_b", text: "b-2" }),
		]);
		assert.equal(previousFor(h.seen, "a-2"), "Q:a-1");
		assert.equal(previousFor(h.seen, "b-2"), "Q:b-1");
	} finally {
		h.store.close();
	}
});
