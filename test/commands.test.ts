import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CommandActions,
	type CommandContext,
	type CommandState,
	handleSupportCommand,
	parseSupportCommand,
	extractFeedbackId,
	FEATURE_TEMPLATE,
	BUG_TEMPLATE,
	FEEDBACK_ID_GUIDE,
	COMMAND_HELP,
} from "../src/commands.ts";

function fixture(state: CommandState = {}) {
	const context: CommandContext = {
		conversationKey: "tenant:user:chat",
		memoryKey: "memory:thread",
		origin: { chatType: "p2p", userId: "ou_user", chatId: "oc_chat" },
		mentions: [],
		messageId: "message-1",
		state,
	};
	const saved: CommandState[] = [];
	const resets: string[] = [];
	const registrations: Parameters<CommandActions["registerFeedback"]>[0][] = [];
	const actions: CommandActions = {
		resetContext: async (key) => { resets.push(key); },
		saveState: async (_key, next) => { saved.push(next); },
		status: async () => "问答：未启动；反馈：只读",
		registerFeedback: async (input) => { registrations.push(input); return { recordId: "record-1" }; },
	};
	return { context, actions, saved, resets, registrations };
}

test("ordinary questions do not run command actions", async () => {
	const f = fixture();
	assert.equal(await handleSupportCommand("如何配置 MCP？", f.context, f.actions), undefined);
	assert.equal(f.saved.length, 0);
});

test("help and status return deterministic host output", async () => {
	const f = fixture();
	const help = (await handleSupportCommand("/help", f.context, f.actions)) ?? "";
	assert.match(help, /只回答 Step Code 的使用问题/);
	assert.match(help, /\/bug：/);
	assert.match(help, /\/feature：/);
	assert.doesNotMatch(help, /\/feedback/);
	assert.equal(await handleSupportCommand("/status", f.context, f.actions), "问答：未启动；反馈：只读");
});

test("product name is always written as Step Code", () => {
	for (const text of [COMMAND_HELP, BUG_TEMPLATE, FEATURE_TEMPLATE, FEEDBACK_ID_GUIDE]) {
		assert.doesNotMatch(text, /StepCode|Step-Code/u);
	}
});

test("unknown commands, including the removed /version, fail closed", () => {
	for (const text of ["/bash rm -rf /", "/help extra", "/status extra", "/version", "/version v0.1.2"]) {
		assert.equal(parseSupportCommand(text)?.type, "invalid");
	}
	assert.doesNotMatch(COMMAND_HELP, /\/version/);
});

test("new clears feedback association without deleting remote records", async () => {
	const f = fixture({ feedback: { recordId: "existing" } });
	await handleSupportCommand("/new", f.context, f.actions);
	assert.deepEqual(f.saved, [{}]);
	assert.deepEqual(f.resets, ["memory:thread"]);
	assert.equal(f.registrations.length, 0);
});

test("/feedback in any form is the client command and never registers here", async () => {
	for (const text of ["/feedback", "/feedback bug Step Code crash", "/feedback feature", "/feedback id abc-123"]) {
		const f = fixture();
		const reply = (await handleSupportCommand(text, f.context, f.actions)) ?? "";
		assert.match(reply, /Step Code 客户端里的命令/);
		assert.match(reply, /\/bug/);
		assert.match(reply, /\/feature/);
		assert.equal(f.registrations.length, 0);
		assert.equal(f.saved.length, 0);
	}
});

test("bug template asks for an optional Feedback ID and explains how to get it", () => {
	assert.match(BUG_TEMPLATE, /遇到的问题/);
	assert.match(BUG_TEMPLATE, /当时做了什么/);
	assert.match(BUG_TEMPLATE, /原本希望怎样/);
	assert.match(BUG_TEMPLATE, /^Feedback ID：/mu);
	assert.ok(BUG_TEMPLATE.includes(FEEDBACK_ID_GUIDE));
	assert.match(FEEDBACK_ID_GUIDE, /Step Code 客户端的对话输入框输入 \/feedback/);
	assert.match(FEEDBACK_ID_GUIDE, /更快定位问题/);
	assert.match(FEEDBACK_ID_GUIDE, /拿不到 ID 也没关系/);
	assert.match(BUG_TEMPLATE, /请勿包含密钥或私有代码/);
});

test("feature template stays simple and has no Feedback ID line", () => {
	assert.match(FEATURE_TEMPLATE, /想要的功能/);
	assert.match(FEATURE_TEMPLATE, /使用场景/);
	assert.match(FEATURE_TEMPLATE, /希望怎么用/);
	assert.doesNotMatch(FEATURE_TEMPLATE, /Feedback ID/);
	assert.doesNotMatch(FEATURE_TEMPLATE, /环境与渠道：|验收标准：|交互与权限：|使用频率与替代方式：/);
});

test("bare or unchanged templates are read-only and never register", async () => {
	const f = fixture();
	assert.equal(await handleSupportCommand("/bug", f.context, f.actions), BUG_TEMPLATE);
	assert.equal(await handleSupportCommand("/feature", f.context, f.actions), FEATURE_TEMPLATE);
	assert.equal(await handleSupportCommand(BUG_TEMPLATE.slice(BUG_TEMPLATE.indexOf("/bug")), f.context, f.actions), BUG_TEMPLATE);
	assert.equal(
		await handleSupportCommand(FEATURE_TEMPLATE.slice(FEATURE_TEMPLATE.indexOf("/feature")), f.context, f.actions),
		FEATURE_TEMPLATE,
	);
	assert.equal(f.registrations.length, 0);
	assert.equal(f.saved.length, 0);
});

test("excessive feedback is rejected", () => {
	assert.equal(parseSupportCommand("/bug " + "a".repeat(4001))?.type, "invalid");
	assert.equal(parseSupportCommand("/feature " + "a".repeat(4001))?.type, "invalid");
	assert.equal(parseSupportCommand("/desktop " + "a".repeat(4001))?.type, "invalid");
});

test("desktop command parses, stays read-only when bare, and appears in help", () => {
	assert.deepEqual(parseSupportCommand("/desktop"), { type: "desktop-template" });
	assert.deepEqual(parseSupportCommand("/desktop 设置页打不开"), { type: "desktop", description: "设置页打不开" });
	assert.match(COMMAND_HELP, /\/desktop <问题描述>：/);
});

test("desktop registration passes origin and mentions through and replies with the record link", async () => {
	const f = fixture();
	const seen: Parameters<NonNullable<CommandActions["registerDesktopFeedback"]>>[0][] = [];
	f.actions.registerDesktopFeedback = async (input) => {
		seen.push(input);
		return { recordId: "rec123", attached: 2, status: "处理中", assigned: { id: "ou_long", name: "龙永深（ZouR-Ma）" } };
	};
	const reply = (await handleSupportCommand("/desktop 设置页打不开", f.context, f.actions)) ?? "";
	assert.deepEqual(seen, [{
		conversationKey: "tenant:user:chat",
		messageId: "message-1",
		description: "设置页打不开",
		origin: { chatType: "p2p", userId: "ou_user", chatId: "oc_chat" },
		mentions: [],
	}]);
	assert.match(reply, /已记录桌面端问题/);
	assert.match(reply, /record=rec123/);
	assert.match(reply, /已附 2 个图片\/文件/);
	assert.match(reply, /状态：处理中｜Dev 负责人：龙永深（ZouR-Ma）/);
	assert.equal(f.saved.length, 0);
});

test("desktop reply reports attachment sync failures without hiding the record link", async () => {
	const f = fixture();
	f.actions.registerDesktopFeedback = async () => ({ recordId: "rec123", attached: null, status: "未处理" });
	const reply = (await handleSupportCommand("/desktop 设置页打不开", f.context, f.actions)) ?? "";
	assert.match(reply, /未能自动附加/);
	assert.match(reply, /record=rec123/);
	assert.doesNotMatch(reply, /状态：/);
});

test("desktop reply surfaces a suspected duplicate without auto-merging", async () => {
	const f = fixture();
	f.actions.registerDesktopFeedback = async () => ({
		recordId: "rec123",
		attached: 0,
		status: "未处理",
		suspectedDuplicate: { recordId: "recOld", reason: "同为设置页白屏" },
	});
	const reply = (await handleSupportCommand("/desktop 设置页打开白屏", f.context, f.actions)) ?? "";
	assert.match(reply, /疑似与已有问题重复（同为设置页白屏）/);
	assert.match(reply, /record=recOld/);
	assert.match(reply, /归并/);
	assert.match(reply, /状态置「重复」/);
});

test("wish parses, stays read-only when bare, and replies with the record link", async () => {
	assert.deepEqual(parseSupportCommand("/wish"), { type: "wish-template" });
	assert.deepEqual(parseSupportCommand("/wish 希望支持深色模式"), {
		type: "wish",
		description: "希望支持深色模式",
	});
	assert.equal(parseSupportCommand("/wish " + "a".repeat(4001))?.type, "invalid");
	assert.match(COMMAND_HELP, /\/wish <愿望描述>/);
	const f = fixture();
	f.actions.registerWish = async () => ({ recordId: "recW", attached: 1 });
	const reply = (await handleSupportCommand("/wish 希望支持深色模式", f.context, f.actions)) ?? "";
	assert.match(reply, /愿望已记录/);
	assert.match(reply, /record=recW/);
	assert.match(reply, /已附 1 个图片\/文件/);
});

test("wish without wiring reports the feature as unavailable", async () => {
	const f = fixture();
	assert.match((await handleSupportCommand("/wish 深色模式", f.context, f.actions)) ?? "", /未启用/);
});

test("desktop without wiring reports the feature as unavailable", async () => {
	const f = fixture();
	assert.match((await handleSupportCommand("/desktop 设置页打不开", f.context, f.actions)) ?? "", /未启用/);
});

test("filled bug with Feedback ID registers the opaque ID and confirms it", async () => {
	const f = fixture();
	const description = "遇到的问题：Step Code 输入后无响应\n当时做了什么：提交任务\n原本希望怎样：看到回复\nFeedback ID：Actual_Client_ID-123";
	const reply = (await handleSupportCommand(`/bug\n${description}`, f.context, f.actions)) ?? "";
	assert.equal(f.registrations[0].kind, "Bug");
	assert.equal(f.registrations[0].description, description);
	assert.equal(f.registrations[0].feedbackId, "Actual_Client_ID-123");
	assert.equal(f.registrations[0].messageId, "message-1");
	assert.deepEqual(f.saved, [{ feedback: { recordId: "record-1" } }]);
	assert.match(reply, /Feedback ID Actual_Client_ID-123/);
	assert.match(reply, /尽快排查跟进/);
});

test("filled bug without Feedback ID still registers and suggests attaching one next time", async () => {
	const f = fixture();
	const reply = (await handleSupportCommand("/bug Step Code 启动后白屏\nFeedback ID：（选填，获取方式见下方）", f.context, f.actions)) ?? "";
	assert.equal(f.registrations.length, 1);
	assert.equal(f.registrations[0].feedbackId, undefined);
	assert.match(reply, /已收到您反馈的问题/);
	assert.match(reply, /附上 Feedback ID/);
});

test("filled feature registers without ID wording", async () => {
	const f = fixture();
	const description = "想要的功能：Step Code 飞书远程会话\n使用场景：离开电脑后查看任务\n希望怎么用：飞书发送任务并看到完成通知";
	const reply = (await handleSupportCommand(`/feature\n${description}`, f.context, f.actions)) ?? "";
	assert.equal(f.registrations[0].kind, "Feature");
	assert.equal(f.registrations[0].description, description);
	assert.match(reply, /已收到您的功能建议/);
	assert.doesNotMatch(reply, /Feedback ID/);
});

test("Feedback ID extraction is opaque and ignores placeholders or free text", () => {
	assert.equal(extractFeedbackId("Feedback ID：fb_9f2-ABC"), "fb_9f2-ABC");
	assert.equal(extractFeedbackId("feedback id: fb_9f2-ABC"), "fb_9f2-ABC");
	assert.equal(extractFeedbackId("Feedback ID：（选填，获取方式见下方）"), undefined);
	assert.equal(extractFeedbackId("Feedback ID："), undefined);
	assert.equal(extractFeedbackId("Feedback ID：没有 拿到"), undefined);
	assert.equal(extractFeedbackId("没有 ID 这一行"), undefined);
});

test("diagnose requires exactly one UUID feedback ID", () => {
	assert.deepEqual(parseSupportCommand("/diagnose 123e4567-e89b-42d3-a456-426614174000"), {
		type: "diagnose",
		feedbackId: "123e4567-e89b-42d3-a456-426614174000",
	});
	const normalized = parseSupportCommand("/diagnose 123E4567-E89B-42D3-A456-426614174000");
	assert.equal(normalized?.type === "diagnose" ? normalized.feedbackId : undefined, "123e4567-e89b-42d3-a456-426614174000");
	for (const text of ["/diagnose", "/diagnose fb_9f2-ABC", "/diagnose 123e4567-e89b-42d3-a456-426614174000 extra"]) {
		assert.equal(parseSupportCommand(text)?.type, "invalid");
	}
	const bare = parseSupportCommand("/diagnose");
	assert.match(bare?.type === "invalid" ? bare.message : "", /用法：\/diagnose <Feedback ID>/);
	assert.match(COMMAND_HELP, /\/diagnose <Feedback ID>：/);
	assert.doesNotMatch(COMMAND_HELP, /\/feedback/);
});

test("diagnose routes to the diagnostics action without touching conversation state", async () => {
	const f = fixture();
	const seen: string[] = [];
	f.actions.diagnose = async (feedbackId) => {
		seen.push(feedbackId);
		return "初步诊断（mock）";
	};
	assert.equal(
		await handleSupportCommand("/diagnose 123e4567-e89b-42d3-a456-426614174000", f.context, f.actions),
		"初步诊断（mock）",
	);
	assert.deepEqual(seen, ["123e4567-e89b-42d3-a456-426614174000"]);
	assert.equal(f.saved.length, 0);
	assert.equal(f.registrations.length, 0);
	assert.equal(f.resets.length, 0);
});

test("diagnose without wiring reports the feature as unavailable", async () => {
	const f = fixture();
	assert.match(
		(await handleSupportCommand("/diagnose 123e4567-e89b-42d3-a456-426614174000", f.context, f.actions)) ?? "",
		/诊断功能当前未启用/,
	);
});
