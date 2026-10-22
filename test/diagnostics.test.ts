import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DIAGNOSE_USAGE } from "../src/commands.ts";
import {
	FeedbackDiagnostics,
	formatDiagnosis,
	parseLookupHtml,
	reduceEvents,
	scrubReply,
	type DiagnosisVerdict,
} from "../src/diagnostics.ts";

const ID = "123e4567-e89b-42d3-a456-426614174000";

function lookupPage(options?: { notFound?: boolean; noBundle?: boolean; extracted?: boolean; sha256?: string }): string {
	if (options?.notFound) {
		return `<!doctype html><html><body><div class="panel"><h2>没有这条反馈</h2><p class="state"><span class="mono">${ID}</span> 在 step_cli_feedback 里没有对应的行。</p></div></body></html>`;
	}
	const bundlePanel = options?.noBundle
		? ""
		: ` <div class="panel">
      <h2>会话包</h2>
      <dl class="kv" style="margin-bottom:12px">
        <dt>大小</dt><dd>442.9 KB</dd>
        <dt>入桶时间</dt><dd>2026-10-21 13:35:08</dd>
        <dt>对象</dt><dd class="mono">step_cli_feedback/dt=2026-10-21/feedback_id=${ID}/session-bundle.tar.gz</dd>
      </dl>
      ${
				options?.extracted === false
					? ""
					: `<dl class="kv" style="margin-bottom:12px">
          <dt>已解压文件</dt>
          <dd>
            <div><a href="/api/v1/feedback/${ID}/bundle/files/events.jsonl" target="_blank">events.jsonl</a>
              <span class="muted">1.4 MB &middot; ${options?.sha256 ?? "0".repeat(64)}</span></div>
          </dd>
        </dl>`
			}
      <a class="dl" href="/api/v1/feedback/${ID}/bundle">下载原始 session-bundle.tar.gz</a>
    </div>`;
	return `<!doctype html><html lang="zh"><body>
  <div class="panel">
    <h2>反馈 <span class="tag">safety_check</span></h2>
    <dl class="kv">
      <dt>feedbackId</dt><dd class="mono">${ID}</dd>
      <dt>提交时间</dt><dd>2026-10-21 13:35:08 <span class="muted">server_ts</span> &middot; <span class="muted">客户端自报 2026-10-21 13:35:06</span></dd>
      <dt>会话</dt><dd><span class="mono">477791dc-1f7b-4aa1-bbb8-b77288bacfe4</span></dd>
      <dt>客户端</dt><dd>release &middot; 0.1.5 &middot; linux &middot; <span class="mono">3992441e</span></dd>
      <dt>提交者</dt><dd>i-panhaoran &middot; <span class="muted">未登录</span> &middot; <span class="muted">device</span> <span class="mono">369cffc0-0679-4a38-a542-8c57dc0bcae6</span></dd>
    </dl>
  </div>
  <div class="panel"><h2>用户原话</h2><p class="prose">子代理的&amp;安全 &lt;测试&gt; 目录操作被拒绝</p></div>
  ${bundlePanel}
</body></html>`;
}

const EVENTS = [
	JSON.stringify({ type: "session", version: 3, id: "s1", timestamp: "2026-10-21T03:49:23.068Z", cwd: "/home/alice/proj" }),
	JSON.stringify({ type: "model_change", id: "m1", parentId: null, timestamp: "2026-10-21T03:49:23.284Z", provider: "stepcode-responses", modelId: "gpt-6-astra-ptu" }),
	JSON.stringify({ type: "thinking_level_change", id: "t1", parentId: "m1", timestamp: "2026-10-21T03:49:23.284Z", thinkingLevel: "xhigh" }),
	JSON.stringify({ type: "custom", customType: "step.activity", id: "c1", parentId: "t1", timestamp: "2026-10-21T03:49:23.382Z", data: { resourceId: "/home/alice/.claude/skills/x/SKILL.md" } }),
	JSON.stringify({ type: "message", id: "a1", parentId: "t1", timestamp: "2026-10-21T03:50:45.876Z", message: { role: "user", content: [{ type: "text", text: "帮我整理 /home/alice/data 下的文件" }], timestamp: 1792554645867 } }),
	JSON.stringify({ type: "message", id: "a2", parentId: "a1", timestamp: "2026-10-21T03:50:48.505Z", message: { role: "assistant", content: [{ type: "toolCall", id: "call1", name: "run_command", arguments: { command: "ls" } }], stopReason: "toolUse" } }),
	JSON.stringify({ type: "message", id: "a3", parentId: "a2", timestamp: "2026-10-21T03:50:49.1Z", message: { role: "toolResult", content: [{ type: "text", text: "DENIED COMMAND git status --short" }] } }),
	JSON.stringify({ type: "message", id: "a4", parentId: "a3", timestamp: "2026-10-21T03:50:52.0Z", message: { role: "assistant", content: [{ type: "text", text: "操作被运行时权限拒绝，无法继续。" }], stopReason: "error" } }),
	"{this is not json",
	"",
].join("\n");

test("lookup page is parsed without reading the submitter row", () => {
	const sha = "a".repeat(64);
	const lookup = parseLookupHtml(lookupPage({ sha256: sha }));
	assert.equal(lookup.found, true);
	if (!lookup.found) return;
	assert.equal(lookup.category, "safety_check");
	assert.equal(lookup.comment, "子代理的&安全 <测试> 目录操作被拒绝");
	assert.equal(lookup.clientLine, "release · 0.1.5 · linux · 3992441e");
	assert.equal(lookup.serverTs, "2026-10-21 13:35:08");
	assert.equal(lookup.hasBundle, true);
	assert.deepEqual(lookup.files, [{ name: "events.jsonl", sha256: sha }]);
	assert.doesNotMatch(JSON.stringify(lookup), /panhaoran|369cffc0/);
	assert.equal(parseLookupHtml(lookupPage({ notFound: true })).found, false);
	const unextracted = parseLookupHtml(lookupPage({ extracted: false }));
	assert.ok(unextracted.found && unextracted.hasBundle && unextracted.files.length === 0);
	const bare = parseLookupHtml(lookupPage({ noBundle: true }));
	assert.ok(bare.found && !bare.hasBundle);
	assert.throws(() => parseLookupHtml("<html><body>unknown page</body></html>"), /Unrecognized/);
});

test("event digest keeps counts and masks submitter paths", () => {
	const digest = reduceEvents(EVENTS);
	assert.ok(digest.length <= 12000);
	const parsed = JSON.parse(digest.replace(/…\(truncated\)$/, "")) as Record<string, unknown>;
	assert.equal(parsed.eventsParsed, 9);
	assert.equal(parsed.parseErrors, 1);
	assert.equal(parsed.sessionStart, "2026-10-21T03:49:23.068Z");
	assert.deepEqual(parsed.firstUserRequests, ["帮我整理 /home/~/data 下的文件"]);
	assert.ok(JSON.stringify(parsed.lastAssistantNotes).includes("运行时权限拒绝"));
	assert.ok(JSON.stringify(parsed.errorSignals).includes("DENIED COMMAND"));
	assert.ok(!JSON.stringify(parsed).includes("alice"));
	assert.ok((parsed.stopReasons as string[]).includes("error x1"));
	assert.ok((parsed.toolCalls as string[]).includes("run_command x1"));
	const tail = parsed.tail as string[];
	assert.ok(tail.length <= 25 && tail[tail.length - 1].includes("assistant [error]"));
});

test("large event logs collapse to the digest budget", () => {
	const heavy = Array.from({ length: 5000 }, (_unused, index) =>
		JSON.stringify({
			type: "message",
			id: `x${index}`,
			timestamp: new Date(1792554000000 + index * 1000).toISOString(),
			message: { role: index % 2 ? "assistant" : "user", content: [{ type: "text", text: `x`.repeat(120) }] },
		}),
	).join("\n");
	const digest = reduceEvents(heavy);
	assert.ok(digest.length <= 12000);
	assert.ok(digest.includes("eventsParsed\":5000"));
});

test("reply scrub removes identities", () => {
	const scrubbed = scrubReply("来自 220.203.250.24 的 ou_abc123 和 om_xyz789 与 /home/bob/proj");
	assert.doesNotMatch(scrubbed, /220\.203|ou_abc|om_xyz|\/home\/bob/);
	assert.match(scrubbed, /\[已隐去\]/);
});

test("diagnosis formatting renders bounded plain-text sections", () => {
	const verdict: DiagnosisVerdict = {
		conclusion: "写入被运行时权限拒绝。",
		evidence: ["stopReason error x1"],
		likelyCauses: ["审批链路被父进程取消"],
		suggestions: ["升级后重试"],
		confidence: "medium",
		needsHuman: true,
	};
	const reply = formatDiagnosis(verdict, ID);
	assert.match(reply, /初步诊断（Feedback 123e4567/);
	assert.match(reply, /可信度：中；建议人工跟进/);
	assert.ok(reply.endsWith("仅供参考；输出已做脱敏处理。"));
	const minimal = formatDiagnosis({ ...verdict, evidence: [], likelyCauses: [], suggestions: [], needsHuman: false }, ID);
	assert.doesNotMatch(minimal, /证据要点|可能原因|建议\n|人工跟进/);
});

interface Harness {
	diagnostics: FeedbackDiagnostics;
	modelCalls: string[];
	downloads: number;
	lookups: number;
	stateDir: string;
}

function harness(events: string, options?: { sha256?: string; verdict?: string; reserve?: boolean }): Harness {
	const stateDir = mkdtempSync(join(tmpdir(), "diagnose-"));
	const sha256 = options?.sha256 ?? createHash("sha256").update(events).digest("hex");
	const modelCalls: string[] = [];
	let downloads = 0;
	let lookups = 0;
	const fetchImpl = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
		const url = String(input);
		if (url.includes("/lookup?feedbackId=")) {
			lookups++;
			return new Response(lookupPage({ sha256 }), { headers: { "content-type": "text/html" } });
		}
		if (url.endsWith("/bundle/files/events.jsonl")) {
			downloads++;
			return new Response(events, { headers: { "content-type": "application/x-ndjson" } });
		}
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	const diagnostics = new FeedbackDiagnostics("https://dashboard.example", stateDir, {
		reserve: () => options?.reserve ?? true,
		call: async (system, input, timeoutMs) => {
			modelCalls.push(input);
			assert.match(system, /untrusted data/);
			assert.equal(timeoutMs, 90000, "diagnose must extend the model deadline");
			return (
				options?.verdict ??
				JSON.stringify({
					conclusion: "写入被权限拒绝。IP 10.1.2.3",
					evidence: ["stopReason error x1"],
					likelyCauses: ["审批被父进程取消"],
					suggestions: ["升级到最新版本"],
					confidence: "medium",
					needsHuman: true,
				})
			);
		},
		fetch: fetchImpl,
	});
	return {
		diagnostics,
		modelCalls,
		// Primitive counters are snapshotted if returned directly; getters expose the live closure values.
		get downloads() {
			return downloads;
		},
		get lookups() {
			return lookups;
		},
		stateDir,
	};
}

test("diagnose downloads, analyzes once, caches and never sees submitter identity", async () => {
	const h = harness(EVENTS);
	try {
		const reply = await h.diagnostics.diagnose(ID);
		assert.match(reply, /初步诊断/);
		assert.match(reply, /证据要点/);
		assert.doesNotMatch(reply, /10\.1\.2\.3/);
		assert.equal(h.lookups, 1);
		assert.equal(h.downloads, 1);
		assert.equal(h.modelCalls.length, 1);
		const input = JSON.parse(h.modelCalls[0]) as Record<string, unknown>;
		assert.match(JSON.stringify(input.feedback), /safety_check/);
		assert.ok(String(input.digest).includes("eventsParsed"));
		assert.doesNotMatch(h.modelCalls[0], /panhaoran|369cffc0/);
		assert.equal(await h.diagnostics.diagnose(ID), reply);
		assert.equal(h.modelCalls.length, 1, "cached reply must not re-run the model");
	} finally {
		rmSync(h.stateDir, { recursive: true, force: true });
	}
});

test("diagnose fails closed on checksum mismatch without model spend", async () => {
	const h = harness(EVENTS, { sha256: "f".repeat(64) });
	try {
		assert.match(await h.diagnostics.diagnose(ID), /诊断暂时失败/);
		assert.equal(h.modelCalls.length, 0);
	} finally {
		rmSync(h.stateDir, { recursive: true, force: true });
	}
});

test("diagnose reports lookup states without downloading", async () => {
	const stateDir = mkdtempSync(join(tmpdir(), "diagnose-"));
	const pages: Record<string, string> = {
		[ID]: lookupPage({ notFound: true }),
	};
	const fetchImpl = (async (input: Parameters<typeof fetch>[0]): Promise<Response> =>
		new Response(pages[String(input).split("feedbackId=")[1]] ?? lookupPage({ notFound: true }), {
			headers: { "content-type": "text/html" },
		})) as typeof fetch;
	let modelCalls = 0;
	const diagnostics = new FeedbackDiagnostics("https://dashboard.example", stateDir, {
		reserve: () => true,
		call: async () => {
			modelCalls++;
			return "{}";
		},
		fetch: fetchImpl,
	});
	try {
		assert.match(await diagnostics.diagnose(ID), /没有找到这条反馈/);
		pages[ID] = lookupPage({ noBundle: true });
		assert.match(await diagnostics.diagnose(ID), /没有附带会话包/);
		pages[ID] = lookupPage({ extracted: false });
		assert.match(await diagnostics.diagnose(ID), /仍在处理中/);
		assert.match(await diagnostics.diagnose("not-a-uuid"), /格式不正确/);
		assert.equal(modelCalls, 0);
	} finally {
		rmSync(stateDir, { recursive: true, force: true });
	}
});

test("diagnose respects the daily budget and rejects malformed model output", async () => {
	const budget = harness(EVENTS, { reserve: false });
	try {
		assert.match(await budget.diagnostics.diagnose(ID), /预算已用完/);
		assert.equal(budget.modelCalls.length, 0);
	} finally {
		rmSync(budget.stateDir, { recursive: true, force: true });
	}
	for (const verdict of ["not json", '{"conclusion":"x","confidence":"high","needsHuman":true}', '{"conclusion":"x","evidence":[],"likelyCauses":[],"suggestions":[],"confidence":"maybe","needsHuman":false}']) {
		const h = harness(EVENTS, { verdict });
		try {
			assert.match(await h.diagnostics.diagnose(ID), /诊断暂时失败/);
		} finally {
			rmSync(h.stateDir, { recursive: true, force: true });
		}
	}
});

test("overlong model lists are truncated instead of failing the diagnosis", async () => {
	const h = harness(EVENTS, {
		verdict: JSON.stringify({
			conclusion: "c",
			evidence: ["e1", "e2", "e3", "e4", "e5", "e6", 7],
			likelyCauses: ["l1", "l2", "l3", "l4"],
			suggestions: ["s1", "s2", "s3", "s4"],
			confidence: "low",
			needsHuman: false,
		}),
	});
	try {
		const reply = await h.diagnostics.diagnose(ID);
		assert.match(reply, /初步诊断/);
		assert.doesNotMatch(reply, /e6|s4|^4\. /m);
		assert.equal((reply.match(/^- /gmu) ?? []).length, 8, "5 evidence + 3 suggestions survive");
	} finally {
		rmSync(h.stateDir, { recursive: true, force: true });
	}
});

test("diagnose usage text is stable", () => {
	assert.match(DIAGNOSE_USAGE, /\/diagnose <Feedback ID>/);
	assert.doesNotMatch(DIAGNOSE_USAGE, /\/feedback/);
});
