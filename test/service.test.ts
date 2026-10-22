import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { containsSensitiveInput } from "../src/config.ts";
import { BUG_TEMPLATE, FEATURE_TEMPLATE, FEEDBACK_ID_GUIDE, IMPROVE_HINT } from "../src/commands.ts";
import { SupportHost } from "../src/host.ts";
import { SupportKnowledge, validateGroundedAnswer } from "../src/knowledge.ts";
import { createSupportModel, isolatedResources, SupportAnswerer } from "../src/model.ts";
import { SupportStateStore } from "../src/state-store.ts";
import { consumeMessages, decodeMessage, deliverMessage, replyKey } from "../src/transport.ts";

const root = resolve(import.meta.dirname, "../../..");
const BOT = "ou_bot";
const event = { type: "im.message.receive_v1", chat_type: "p2p", sender_type: "user", message_type: "text", sender_id: "ou_user", chat_id: "oc_chat", message_id: "om_message", content: "/help" };

test("CLI event schema is decoded without parsing already-rendered content", () => {
	const message = decodeMessage(event, "tenant", BOT);
	assert.equal(message?.text, "/help");
	assert.equal(message?.tenantId, "tenant");
	for (const changes of [{ chat_type: "group" }, { sender_type: "bot" }, { message_type: "image" }]) {
		assert.equal(decodeMessage({ ...event, ...changes }, "tenant", BOT), undefined);
	}
	assert.throws(() => decodeMessage({ ...event, sender_id: "untrusted" }, "tenant", BOT));
});

test("isolated SDK resource loader has no discovered resources or personal credentials", async () => {
	const resources = isolatedResources("support only");
	assert.equal(resources.getSystemPrompt(), "support only");
	assert.deepEqual(resources.getAgentsFiles(), { agentsFiles: [] });
	assert.deepEqual(resources.getSkills().skills, []);
	assert.deepEqual(resources.getExtensions().extensions, []);
	// Creation registers the real provider/runtime but does not call its paid endpoint.
	assert.equal(typeof await createSupportModel("offline-test-only", root), "function");
});

test("knowledge snapshots are bounded and citations are validated", () => {
	const knowledge = new SupportKnowledge(root);
	const evidence = knowledge.search("Step Code login 登录");
	assert.ok(evidence.length > 0 && evidence.length <= 5);
	assert.ok(evidence.every((item) => item.text.length <= 3601));
	assert.match(validateGroundedAnswer(JSON.stringify({ answer: "使用登录命令。", sources: [1], feedbackKind: "none" }), evidence, knowledge.snapshot), /来源/);
	assert.match(validateGroundedAnswer('```json\n{"answer":"使用登录命令。","sources":[1],"feedbackKind":"none"}\n```', evidence, knowledge.snapshot), /来源/);
	assert.match(validateGroundedAnswer('extra\n```json\n{"answer":"使用登录命令。","sources":[1]}\n```', evidence, knowledge.snapshot), /未通过校验/);
	for (const value of [{ answer: "invented", sources: [99] }, { answer: "https://evil.example", sources: [1] }]) {
		assert.match(validateGroundedAnswer(JSON.stringify(value), evidence, knowledge.snapshot), /未通过校验/);
	}
});

test("scope routing rejects unrelated and malformed outputs without answering", async () => {
	for (const output of ['{"scope":"unrelated","question":""}', "invalid"]) {
		const store = new SupportStateStore(":memory:");
		let calls = 0;
		try {
			const answerer = new SupportAnswerer(async () => { calls++; return output; }, new SupportKnowledge(root), store, 10);
			const answer = await answerer.answer("write a game", { conversationKey: "a", memoryKey: "a", messageId: "1", state: {} });
			assert.equal(calls, 1);
			assert.match(answer, /只回答|校验/);
		} finally { store.close(); }
	}
});

test("question feedback projections render exact guidance without writing or reclassifying replay", async () => {
	for (const feedbackKind of ["bug", "feature", "improve", "none", "unclear"]) {
		const store = new SupportStateStore(":memory:");
		let calls = 0;
		const answerer = new SupportAnswerer(async (system) => {
			calls++;
			if (system.startsWith("Classify")) return '{"scope":"related","question":"Step Code login"}';
			assert.match(system, /Classification never creates a Base record/);
			assert.doesNotMatch(system, /Include the template dimensions/);
			return JSON.stringify({ answer: "结论\n请核对登录状态。", sources: [1], feedbackKind });
		}, new SupportKnowledge(root), store, 10);
		const host = new SupportHost(store, {
			admit: async () => true, answer: (text, context) => answerer.answer(text, context),
			resetContext: async () => {}, status: async () => "running",
			registerFeedback: async () => { assert.fail("consultation must not create records"); },
					});
		try {
			const message = decodeMessage({ ...event, content: "Step Code login" }, "tenant", BOT);
			assert.ok(message);
			const result = await host.handle(message);
			const reply = result?.reply ?? "";
			assert.match(reply, /来源/);
			if (feedbackKind === "bug") {
				assert.ok(reply.endsWith(BUG_TEMPLATE));
				assert.ok(reply.includes(FEEDBACK_ID_GUIDE));
			} else if (feedbackKind === "feature") {
				assert.ok(reply.endsWith(FEATURE_TEMPLATE));
				assert.doesNotMatch(reply, /Feedback ID/);
			} else if (feedbackKind === "improve") {
				// Answer first, then a short /feature reminder rather than the full template.
				assert.ok(reply.indexOf("来源") < reply.indexOf(IMPROVE_HINT));
				assert.ok(reply.endsWith(IMPROVE_HINT));
				assert.match(reply, /\/feature/);
				assert.doesNotMatch(reply, /想要的功能/);
			} else {
				assert.doesNotMatch(reply, /\/feedback|反馈建议/);
				assert.equal(reply.includes("你是遇到了已有功能异常"), feedbackKind === "unclear");
			}
			assert.equal((await host.handle(message))?.reply, reply);
			assert.equal((await host.handle(message))?.replayed, true);
			assert.equal(calls, 2);
			assert.deepEqual(store.listPending(), []);
		} finally { store.close(); }
	}
});

test("model output is normalized to the Step Code product name", () => {
	const evidence = [{ id: 1, path: "public.md", line: 1, text: "Step Code login" }];
	const reply = validateGroundedAnswer(JSON.stringify({ answer: "StepCode 和 Step-Code 都写成 Step Code。", sources: [1], feedbackKind: "none" }), evidence, "test");
	assert.match(reply, /^Step Code 和 Step Code 都写成 Step Code。/u);
	assert.doesNotMatch(reply, /StepCode|Step-Code/u);
});

test("missing or invalid feedback classification fails closed", () => {
	const evidence = [{ id: 1, path: "public.md", line: 1, text: "Step Code login" }];
	for (const feedbackKind of [undefined, null, 1, ["bug"], "Bug", "register"]) {
		const reply = validateGroundedAnswer(JSON.stringify({ answer: "请登录。", sources: [1], feedbackKind }), evidence, "test");
		assert.match(reply, /未通过校验/);
		assert.doesNotMatch(reply, /\/feedback/);
	}
});

test("empty retrieval still allows guidance but never trusts an unsupported answer", async () => {
	const store = new SupportStateStore(":memory:");
	let calls = 0;
	const answerer = new SupportAnswerer(async (system, input) => {
		calls++;
		if (system.startsWith("Classify")) return '{"scope":"related","question":"zzzxxyynonexistent"}';
		assert.deepEqual(JSON.parse(input).evidence, []);
		return '{"answer":"Invented feature is definitely supported.","sources":[],"feedbackKind":"feature"}';
	}, new SupportKnowledge(root), store, 10);
	try {
		const reply = await answerer.answer("希望 Step Code 增加一项功能", { conversationKey: "a", memoryKey: "a", messageId: "1", state: {} });
		assert.equal(calls, 2);
		assert.match(reply, /暂时不能确认结论/);
		assert.ok(reply.endsWith(FEATURE_TEMPLATE));
		assert.doesNotMatch(reply, /Invented|来源/);
		assert.match(validateGroundedAnswer('{"answer":"invented","sources":[1],"feedbackKind":"bug"}', [], "test"), /未通过校验/);
	} finally { store.close(); }
});

test("undocumented TUI behavior with only loosely related retrieval still guides a Bug report", () => {
	// Group report: scrolling up during long thinking jumps the scrollbar to the top once output finishes.
	const evidence = [{ id: 1, path: "knowledge/official/tui.md", line: 3, text: "TUI 支持鼠标滚轮查看历史输出。" }];
	const reply = validateGroundedAnswer(
		'{"answer":"文档未说明滚动位置行为。","sources":[],"feedbackKind":"bug"}',
		evidence,
		"test",
	);
	assert.match(reply, /现有官方文档没有这项行为或能力的说明/);
	assert.ok(reply.endsWith(BUG_TEMPLATE));
	assert.doesNotMatch(reply, /未通过校验|来源|文档未说明滚动位置行为/);
});

test("a malformed grounded answer keeps a valid classification for guidance", () => {
	const evidence = [{ id: 1, path: "knowledge/official/tui.md", line: 3, text: "TUI 说明。" }];
	const reply = validateGroundedAnswer('{"answer":"","sources":[9],"feedbackKind":"bug"}', evidence, "test");
	assert.match(reply, /未通过校验/);
	assert.ok(reply.endsWith(BUG_TEMPLATE));
	assert.match(validateGroundedAnswer("not json", evidence, "test"), /换个说法重问/);
});

test("real host wiring delivers help and grounded answers once across duplicate events", async () => {
	const store = new SupportStateStore(":memory:");
	const knowledge = new SupportKnowledge(root);
	let calls = 0;
	let replies = 0;
	const answerer = new SupportAnswerer(async () => ++calls % 2 === 1 ? '{"scope":"related","question":"Step Code login"}' : '{"answer":"请使用登录命令。","sources":[1],"feedbackKind":"none"}', knowledge, store, 10);
	const host = new SupportHost(store, {
		admit: async (message) => message.userId === "ou_user",
		answer: (text, context) => answerer.answer(text, context), resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => { throw new Error("not authorized for test writes"); },
	});
	try {
		const message = decodeMessage({ ...event, content: "Step Code 怎么登录" }, "tenant", BOT);
		assert.ok(message);
		const reply = async (id: string, text: string, key: string) => {
			replies++; assert.match(text, /来源/); assert.equal(key, replyKey(id)); assert.equal(key.length, 36);
		};
		await deliverMessage(message, host, store, reply);
		await deliverMessage(message, host, store, reply);
		assert.equal(calls, 2); assert.equal(replies, 1);
		await deliverMessage({ ...message, userId: "ou_other" }, host, store, reply);
		assert.equal(replies, 1);
	} finally { store.close(); }
});

test("uncertain sends stay pending and never resend automatically", async () => {
	const store = new SupportStateStore(":memory:");
	const host = new SupportHost(store, {
		admit: async () => true, answer: async () => "answer", resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => ({ recordId: "rec1" }) });
	try {
		const message = decodeMessage(event, "tenant", BOT); assert.ok(message);
		await assert.rejects(deliverMessage(message, host, store, async () => { throw new Error("network"); }));
		await assert.rejects(deliverMessage(message, host, store, async () => { assert.fail("must not resend"); }), /reconciliation/);
		assert.deepEqual(store.listPendingReplies(), [message.messageId]);
		store.completeReply(message.messageId);
	} finally { store.close(); }
});

test("budget and operator reconciliation persist safe terminal outcomes", async () => {
	const store = new SupportStateStore(":memory:");
	try {
		assert.equal(store.reserveModelRequests(3, 4), false);
		assert.equal(store.reserveModelRequests(3, 2), true);
		assert.equal(store.reserveModelRequests(3, 2), false);
		await assert.rejects(store.execute("a", "1", "feedback", async () => { throw new Error("uncertain"); }));
		assert.equal(store.listPending().length, 1);
		store.reconcilePending("a", "1", "recVerified");
		assert.equal(store.ownsFeedback("recVerified", "a"), true);
		assert.equal(store.readState("a").feedback?.recordId, "recVerified");
		assert.equal(store.listPending().length, 0);
		assert.equal((await store.execute("a", "1", "feedback", async () => { assert.fail("never retry"); })).replayed, true);
	} finally { store.close(); }
});

test("credential-shaped inputs are rejected before model and feedback", () => {
	assert.equal(containsSensitiveInput("api_key=secret-value-123"), true);
	assert.equal(containsSensitiveInput("-----BEGIN RSA PRIVATE KEY-----"), true);
	assert.equal(containsSensitiveInput("Step Code 怎么登录？"), false);
});

test("documented placeholder values are not mistaken for leaked credentials", () => {
	const documented = [
		"设置 `STEP_API_KEY=<your_step_api_key>`，或在 /login 中输入。",
		"STEP_API_KEY=<your_step_api_key>",
		"export STEP_API_KEY=${STEP_API_KEY}",
		"api_key={{ api_key }}",
		"access_token=********",
		"密码：请向管理员索取",
	];
	for (const text of documented) assert.equal(containsSensitiveInput(text), false, text);
	const real = ["STEP_API_KEY=abcdef1234567890", "密码：hunter2hunter2", "Authorization: eyJhbGciOiJIUzI1NiJ9"];
	for (const text of real) assert.equal(containsSensitiveInput(text), true, text);
});

test("a knowledge snapshot survives an absent optional translation", async () => {
	const directory = mkdtempSync(join(tmpdir(), "support-kb-"));
	try {
		// Required sources missing is still fatal: no silent empty knowledge base.
		assert.throws(() => new SupportKnowledge(directory), /Missing required knowledge source/u);
		copyFileSync(join(root, "README.md"), join(directory, "README.md"));
		mkdirSync(join(directory, "apps/support-bot/knowledge/official"), { recursive: true });
		for (const note of ["im-capabilities.md", "remote-login.md"]) {
			copyFileSync(join(root, "apps/support-bot/knowledge", note), join(directory, "apps/support-bot/knowledge", note));
		}
		// The official docs snapshot is a required directory too.
		assert.throws(() => new SupportKnowledge(directory), /Missing required knowledge source/u);
		const official = "apps/support-bot/knowledge/official/step-code__reference__slash-commands.md";
		copyFileSync(join(root, official), join(directory, official));
		const knowledge = new SupportKnowledge(directory);
		assert.deepEqual(knowledge.paths, [
			official,
			"README.md",
			"apps/support-bot/knowledge/im-capabilities.md",
			"apps/support-bot/knowledge/remote-login.md",
		]);
		assert.ok(knowledge.search("Step Code login 登录").length > 0);
		// A snapshot identifies exactly the loaded set, so a worktree with the translation differs.
		const complete = new SupportKnowledge(root);
		if (complete.paths.length > knowledge.paths.length) assert.notEqual(knowledge.snapshot, complete.snapshot);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("feedback scope gate cannot be bypassed by slash commands and rejection completes ledger", async () => {
	const store = new SupportStateStore(":memory:");
	let reviews = 0;
	const host = new SupportHost(store, {
		admit: async () => true, answer: async () => "answer", resetContext: async () => {}, status: async () => "running",
		reviewFeedback: async () => { reviews++; return false; },
		registerFeedback: async () => { assert.fail("must not write unrelated feedback"); },
	});
	try {
		const message = decodeMessage({ ...event, content: "/bug my unrelated app crashed" }, "tenant", BOT); assert.ok(message);
		assert.match((await host.handle(message))?.reply ?? "", /未登记/);
		assert.equal((await host.handle(message))?.replayed, true);
		assert.equal(reviews, 1);
		assert.deepEqual(store.listPending(), []);
	} finally { store.close(); }
});

test("subprocess transport waits for readiness, consumes NDJSON and shuts down gracefully", async () => {
	const controller = new AbortController();
	const statuses: string[] = [];
	const timer = setTimeout(() => controller.abort(), 3000);
	let handled = 0;
	try {
		await consumeMessages("tenant", BOT, async (message) => {
			assert.equal(statuses[0], "transport-ready");
			assert.equal(message.messageId, "om_fixture");
			handled++;
			controller.abort();
		}, controller.signal, (status) => statuses.push(status), () => spawn(process.execPath, [resolve(import.meta.dirname, "transport-fixture.mjs")], { stdio: ["pipe", "pipe", "pipe"] }));
		assert.equal(handled, 1);
	} finally { clearTimeout(timer); controller.abort(); }
});

test("sensitive messages never reach answer or feedback actions and replay fixed rejection", async () => {
	const store = new SupportStateStore(":memory:");
	const host = new SupportHost(store, {
		admit: async () => true, answer: async () => { assert.fail("no model request"); },
		resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => { assert.fail("no table write"); } });
	try {
		const message = decodeMessage({ ...event, content: "/bug api_key=secret-value-123" }, "tenant", BOT); assert.ok(message);
		const first = await host.handle(message);
		assert.match(first?.reply ?? "", /未提交模型或反馈表/);
		assert.equal((await host.handle(message))?.reply, first?.reply);
		assert.deepEqual(store.listPending(), []);
	} finally { store.close(); }
});

test("latest-version follow-up retains the preceding IM question in the same conversation", async () => {
	const store = new SupportStateStore(":memory:");
	let classifications = 0;
	let previousQuestion: unknown;
	const answerer = new SupportAnswerer(async (system, input) => {
		if (system.startsWith("Classify")) {
			classifications++;
			const request = JSON.parse(input);
			if (request.text === "最新版本的") {
				previousQuestion = request.previousQuestion;
			}
			return JSON.stringify({ scope: "related", question: "Step Code 有远程连接 IM 的功能吗？" });
		}
		return JSON.stringify({ answer: "目前资料不能确认已发布版本的 IM 连接能力。", sources: [1], feedbackKind: "feature" });
	}, new SupportKnowledge(root), store, 20);
	try {
		const context = { conversationKey: "a", memoryKey: "a", messageId: "1", state: {} };
		assert.match(await answerer.answer("stepcode有远程连接im的功能吗", context), /来源/);
		assert.match(await answerer.answer("最新版本的", { ...context, messageId: "2" }), /来源/);
		assert.equal(classifications, 2);
		assert.equal(previousQuestion, "Step Code 有远程连接 IM 的功能吗？");
	} finally { store.close(); }
});

test("a citation shortened at a path boundary is restored only when unambiguous", () => {
	const evidence = [
		{ id: 1, path: "public.md", line: 1, text: "See https://docs.example/step-code/configuration/models" },
		{ id: 2, path: "other.md", line: 1, text: "See https://docs.example/step-code/configuration/models too" },
	];
	const reply = validateGroundedAnswer(
		JSON.stringify({ answer: "参考 https://docs.example/step-code/configuration", sources: [1], feedbackKind: "none" }),
		evidence,
		"test",
	);
	assert.match(reply, /来源/);
	assert.match(reply, /https:\/\/docs\.example\/step-code\/configuration\/models/u);
	// Ambiguous prefix, bare origin and a different host stay rejected rather than guessed.
	const ambiguous = [
		...evidence,
		{ id: 3, path: "third.md", line: 1, text: "See https://docs.example/step-code/configuration/reference" },
	];
	for (const answer of [
		"参考 https://docs.example/step-code/configu",
		"参考 https://docs.example",
		"参考 https://elsewhere.example/step-code/configuration",
	]) {
		for (const items of [evidence, ambiguous]) {
			assert.match(
				validateGroundedAnswer(JSON.stringify({ answer, sources: [1], feedbackKind: "none" }), items, "test"),
				/未通过校验/u,
			);
		}
	}
	// Two valid extensions of the same prefix must not be collapsed into one of them.
	assert.match(
		validateGroundedAnswer(
			JSON.stringify({
				answer: "参考 https://docs.example/step-code/configuration",
				sources: [1, 3],
				feedbackKind: "none",
			}),
			ambiguous,
			"test",
		),
		/未通过校验/u,
	);
});

test("answer links must exactly match URLs in cited evidence", () => {
	const evidence = [
		{ id: 1, path: "public.md", line: 1, text: "See https://official.example/docs" },
		{ id: 2, path: "other.md", line: 1, text: "See https://other.example/docs" },
	];
	const valid = validateGroundedAnswer(JSON.stringify({ answer: "参考 https://official.example/docs", sources: [1], feedbackKind: "none" }), evidence, "test");
	assert.match(valid, /来源/);
	for (const url of ["https://official.example", "https://official.example/docs/evil", "https://other.example/docs"]) {
		assert.match(validateGroundedAnswer(JSON.stringify({ answer: url, sources: [1], feedbackKind: "none" }), evidence, "test"), /未通过校验/);
	}
});

test("SSH login evidence is separate from IM and release-version notes", () => {
	const knowledge = new SupportKnowledge(root);
	const login = knowledge.search("Step Code 怎样在没有浏览器的远程 SSH 终端登录账号？");
	const note = login.find((item) => item.path === "apps/support-bot/knowledge/remote-login.md");
	assert.ok(note);
	assert.match(note.text, /step login --no-browser/u);
	// The login evidence itself must not carry IM or release-version content into unrelated answers.
	assert.doesNotMatch(note.text, /IM|飞书|v0\.1\.5|版本记录/u);
});

test("IM capability retrieval includes release uncertainty rather than a shipping claim", () => {
	const evidence = new SupportKnowledge(root).search("Step Code 有远程连接 IM 的功能吗？最新版本的");
	assert.ok(evidence.some((item) => item.path === "apps/support-bot/knowledge/im-capabilities.md"));
	assert.match(evidence.map((item) => item.text).join("\n"), /v0\.1\.5[\s\S]*不等同于检查过最新二进制/);
});

test("question context is isolated, expires, resets and is bounded", async (t) => {
	const store = new SupportStateStore(":memory:");
	let now = 1000;
	t.mock.method(Date, "now", () => now);
	const previousQuestions: unknown[] = [];
	const answerer = new SupportAnswerer(async (system, input) => {
		if (system.startsWith("Classify")) {
			const request = JSON.parse(input);
			previousQuestions.push(request.previousQuestion);
			return JSON.stringify({ scope: request.text === "unrelated" ? "unrelated" : "related", question: "Step Code login" });
		}
		return '{"answer":"请登录。","sources":[1],"feedbackKind":"none"}';
	}, new SupportKnowledge(root), store, 1000);
	const ask = (key: string, text = "Step Code login") => answerer.answer(text, { conversationKey: key, memoryKey: key, messageId: String(previousQuestions.length), state: {} });
	try {
		await ask("a");
		await ask("b");
		await ask("a");
		assert.deepEqual(previousQuestions, [undefined, undefined, "Step Code login"]);
		now += 30 * 60 * 1000;
		await ask("a");
		assert.equal(previousQuestions.at(-1), undefined);
		await ask("a");
		assert.equal(previousQuestions.at(-1), "Step Code login");
		answerer.resetContext("a");
		await ask("a");
		assert.equal(previousQuestions.at(-1), undefined);
		await ask("a", "unrelated");
		await ask("a");
		assert.equal(previousQuestions.at(-1), undefined);
		for (let index = 0; index < 100; index++) await ask(`bounded-${index}`);
		await ask("a");
		assert.equal(previousQuestions.at(-1), undefined);
	} finally { store.close(); }
});

test("sensitive input and model-rewritten credentials never enter question context", async () => {
	const store = new SupportStateStore(":memory:");
	let calls = 0;
	const answerer = new SupportAnswerer(async (_system, input) => {
		calls++;
		assert.equal(JSON.parse(input).previousQuestion, undefined);
		return '{"scope":"related","question":"api_key=secret-value-123"}';
	}, new SupportKnowledge(root), store, 10);
	try {
		const context = { conversationKey: "a", memoryKey: "a", messageId: "1", state: {} };
		assert.match(await answerer.answer("api_key=secret-value-123", context), /未提交模型/);
		assert.equal(calls, 0);
		assert.match(await answerer.answer("Step Code login", context), /未通过校验/);
		await answerer.answer("latest version", { ...context, messageId: "2" });
		assert.equal(calls, 2);
	} finally { store.close(); }
});

test("official docs snapshot answers how to start a new session", () => {
	const knowledge = new SupportKnowledge(root);
	assert.ok(knowledge.paths.some((path) => path.startsWith("apps/support-bot/knowledge/official/")));
	const hits = knowledge.search("Step Code 怎么新建一个会话");
	assert.ok(hits.some((hit) => hit.path.includes("official/") && /\/new/.test(hit.text)), "official /new evidence retrieved");
});

test("host /new clears the answerer's follow-up context", async () => {
	const store = new SupportStateStore(":memory:");
	const previousQuestions: unknown[] = [];
	const answerer = new SupportAnswerer(async (system, input) => {
		if (system.startsWith("Classify")) {
			previousQuestions.push(JSON.parse(input).previousQuestion);
			return '{"scope":"related","question":"Step Code login"}';
		}
		return '{"answer":"请登录。","sources":[1],"feedbackKind":"none"}';
	}, new SupportKnowledge(root), store, 20);
	const host = new SupportHost(store, {
		admit: async () => true, answer: (text, context) => answerer.answer(text, context),
		resetContext: async (key) => answerer.resetContext(key), status: async () => "running",
		registerFeedback: async () => { assert.fail("no table write"); } });
	try {
		for (const [index, text] of ["Step Code login", "/new", "latest version"].entries()) {
			const message = decodeMessage({ ...event, message_id: `om_${index}`, content: text }, "tenant", BOT);
			assert.ok(message);
			await host.handle(message);
		}
		assert.deepEqual(previousQuestions, [undefined, undefined]);
	} finally { store.close(); }
});

test("working reaction surrounds model execution and delivery, not duplicate replay", async () => {
	const store = new SupportStateStore(":memory:");
	const order: string[] = [];
	const host = new SupportHost(store, {
		admit: async () => true, answer: async () => { order.push("model"); return "answer"; },
		resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => { assert.fail("no table write"); } });
	const indicator = {
		create: async (id: string) => { assert.equal(id, event.message_id); order.push("create"); return "reaction_owned"; },
		remove: async (id: string, reactionId: string) => {
			assert.equal(id, event.message_id); assert.equal(reactionId, "reaction_owned");
			assert.deepEqual(store.listPendingReplies(), []); order.push("remove");
		},
		failed: () => { assert.fail("indicator should succeed"); },
	};
	try {
		const message = decodeMessage({ ...event, content: "Step Code login" }, "tenant", BOT); assert.ok(message);
		const reply = async () => { order.push("reply"); };
		await deliverMessage(message, host, store, reply, indicator);
		await deliverMessage(message, host, store, reply, indicator);
		assert.deepEqual(order, ["create", "model", "reply", "remove"]);
	} finally { store.close(); }
});

test("working reaction is absent for denied, sensitive and deterministic requests", async () => {
	const store = new SupportStateStore(":memory:");
	const host = new SupportHost(store, {
		admit: async (message) => message.userId === "ou_user", answer: async () => { assert.fail("no model"); },
		resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => { assert.fail("no table write"); } });
	const indicator = {
		create: async () => { assert.fail("no reaction for this request"); },
		remove: async () => { assert.fail("no reaction cleanup"); },
		failed: () => { assert.fail("no reaction operation"); },
	};
	try {
		for (const [index, content] of ["/help", "/new", "/version v0.1.5", "api_key=secret-value-123", "/unknown"].entries()) {
			const message = decodeMessage({ ...event, message_id: `om_${index}`, content }, "tenant", BOT); assert.ok(message);
			await deliverMessage(message, host, store, async () => {}, indicator);
		}
		const message = decodeMessage({ ...event, sender_id: "ou_other", content: "Step Code login" }, "tenant", BOT); assert.ok(message);
		await deliverMessage(message, host, store, async () => { assert.fail("denied reply"); }, indicator);
	} finally { store.close(); }
});

test("reaction API failures do not block delivery or change completed reply claims", async () => {
	for (const failedStage of ["create", "remove"]) {
		const store = new SupportStateStore(":memory:");
		let failures = 0;
		let replies = 0;
		const host = new SupportHost(store, {
			admit: async () => true, answer: async () => "answer", resetContext: async () => {}, status: async () => "running",
			registerFeedback: async () => { assert.fail("no table write"); } });
		try {
			const message = decodeMessage({ ...event, content: "Step Code login" }, "tenant", BOT); assert.ok(message);
			await deliverMessage(message, host, store, async () => { replies++; }, {
				create: async () => { if (failedStage === "create") throw new Error("api"); return "owned"; },
				remove: async () => { if (failedStage === "remove") throw new Error("api"); assert.fail("no known reaction ID"); },
				failed: () => { failures++; },
			});
			assert.equal(failures, 1); assert.equal(replies, 1);
			assert.equal(store.claimReply(message.messageId), "done");
		} finally { store.close(); }
	}
});

test("model or delivery failure clears working indicator without retrying uncertain work", async () => {
	for (const failedStage of ["model", "reply"]) {
		const store = new SupportStateStore(":memory:");
		let removed = 0;
		let created = 0;
		const host = new SupportHost(store, {
			admit: async () => true, answer: async () => { if (failedStage === "model") throw new Error("model"); return "answer"; },
			resetContext: async () => {}, status: async () => "running",
			registerFeedback: async () => { assert.fail("no table write"); } });
		const indicator = {
			create: async () => { created++; return "owned"; }, remove: async () => { removed++; },
			failed: () => { assert.fail("reaction should succeed"); },
		};
		try {
			const message = decodeMessage({ ...event, content: "Step Code login" }, "tenant", BOT); assert.ok(message);
			const reply = async () => { throw new Error("delivery"); };
			await assert.rejects(deliverMessage(message, host, store, reply, indicator));
			assert.equal(removed, 1);
			await assert.rejects(deliverMessage(message, host, store, reply, indicator));
			assert.equal(created, 1); assert.equal(removed, 1);
			assert.equal(failedStage === "model" ? store.listPending().length : store.listPendingReplies().length, 1);
		} finally { store.close(); }
	}
});

test("diagnose command runs the diagnostics action with the working indicator and replays from the ledger", async () => {
	const store = new SupportStateStore(":memory:");
	const seen: string[] = [];
	const order: string[] = [];
	const host = new SupportHost(store, {
		admit: async () => true,
		answer: async () => { assert.fail("diagnose must not hit the QA path"); },
		resetContext: async () => {}, status: async () => "running",
		registerFeedback: async () => { assert.fail("no table write"); },
		diagnose: async (feedbackId) => { seen.push(feedbackId); order.push("diagnose"); return "初步诊断（mock）"; },
	});
	const indicator = {
		create: async () => { order.push("create"); return "owned"; },
		remove: async () => { order.push("remove"); },
		failed: () => { assert.fail("reaction should succeed"); },
	};
	try {
		const message = decodeMessage({ ...event, content: "/diagnose 123e4567-e89b-42d3-a456-426614174000" }, "tenant", BOT);
		assert.ok(message);
		await deliverMessage(message, host, store, async () => { order.push("reply"); }, indicator);
		assert.deepEqual(seen, ["123e4567-e89b-42d3-a456-426614174000"]);
		assert.deepEqual(order, ["create", "diagnose", "reply", "remove"]);
		const second = await host.handle(message);
		assert.equal(second?.reply, "初步诊断（mock）");
		assert.equal(second?.replayed, true);
		assert.deepEqual(store.listPending(), []);
	} finally { store.close(); }
});
