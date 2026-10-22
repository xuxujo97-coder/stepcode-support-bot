import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { BUG_TEMPLATE, FEATURE_TEMPLATE, IMPROVE_HINT } from "./commands.ts";
import { containsSensitiveInput } from "./config.ts";

// Only product documents and reviewed capability notes; no arbitrary paths or project instructions.
// The Chinese README is a translation of the same product content: a worktree that lacks it (for
// example a feature branch cut before it existed) still has usable English evidence, so it is
// optional and the loaded set is reported instead of silently assumed.
// The official Step Code docs snapshot (apps/support-bot/knowledge/official, fetched from
// platform.stepfun.com with source URL and date headers) is the primary product reference; it is
// loaded as a required directory so a missing snapshot fails startup instead of silently degrading.
const OFFICIAL_DIR = "apps/support-bot/knowledge/official";
const SOURCES: { path: string; required: boolean }[] = [
	{ path: "README.md", required: true },
	{ path: "README.zh-CN.md", required: false },
	{ path: "apps/support-bot/knowledge/im-capabilities.md", required: true },
	{ path: "apps/support-bot/knowledge/remote-login.md", required: true },
];

export interface Evidence {
	id: number;
	path: string;
	line: number;
	text: string;
}

export class SupportKnowledge {
	readonly snapshot: string;
	readonly paths: string[];
	private readonly chunks: Omit<Evidence, "id">[] = [];

	constructor(repositoryDir: string) {
		const root = realpathSync(repositoryDir);
		const hash = createHash("sha256");
		const loaded: string[] = [];
		let official: string[];
		try {
			official = readdirSync(join(root, OFFICIAL_DIR))
				.filter((name) => name.endsWith(".md"))
				.sort();
		} catch {
			throw new Error(`Missing required knowledge source: ${OFFICIAL_DIR}`);
		}
		if (!official.length) throw new Error(`Missing required knowledge source: ${OFFICIAL_DIR}`);
		const sources = [...official.map((name) => ({ path: `${OFFICIAL_DIR}/${name}`, required: true })), ...SOURCES];
		for (const source of sources) {
			let actual: string;
			try {
				actual = realpathSync(join(root, source.path));
			} catch {
				if (source.required) throw new Error(`Missing required knowledge source: ${source.path}`);
				continue;
			}
			if (!actual.startsWith(`${root}${sep}`)) throw new Error("Knowledge source escaped repository");
			const stat = statSync(actual);
			if (!stat.isFile() || stat.size > 256 * 1024) throw new Error("Invalid knowledge source size");
			const text = readFileSync(actual, "utf8");
			hash.update(source.path).update(text);
			loaded.push(source.path);
			const lines = text.split("\n");
			let content = "";
			let start = 1;
			for (let index = 0; index < lines.length; index++) {
				if (content.length + lines[index].length > 1800 && content) {
					this.chunks.push({ path: source.path, line: start, text: content });
					content = "";
					start = index + 1;
				}
				content += `${lines[index].slice(0, 1800)}\n`;
			}
			if (content.trim()) this.chunks.push({ path: source.path, line: start, text: content });
		}
		this.paths = loaded;
		this.snapshot = hash.digest("hex").slice(0, 16);
	}

	search(query: string): Evidence[] {
		// Latin/command tokens plus overlapping Han bigrams ("新建会话" -> 新建, 建会, 会话), weighted by
		// inverse document frequency: with the full official docs loaded, ubiquitous terms such as
		// "step-code" or "会话" would otherwise tie every chunk and push the specific answer out.
		const lowered = query.toLowerCase();
		const terms = new Set(lowered.match(/[a-z0-9_/-]{2,}/gu) ?? []);
		for (const run of lowered.match(/\p{Script=Han}+/gu) ?? []) {
			for (let index = 0; index + 2 <= run.length; index++) terms.add(run.slice(index, index + 2));
		}
		const texts = this.chunks.map((chunk) => chunk.text.toLowerCase());
		const weights = new Map<string, number>();
		for (const term of terms) {
			const frequency = texts.filter((text) => text.includes(term)).length;
			if (frequency) weights.set(term, Math.log(1 + texts.length / frequency));
		}
		return this.chunks
			.map((chunk, index) => ({
				chunk,
				score: [...weights].reduce((sum, [term, weight]) => (texts[index].includes(term) ? sum + weight : sum), 0),
			}))
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5)
			.map(({ chunk }, index) => ({ ...chunk, id: index + 1 }));
	}
}

const URL_PATTERN = /https?:\/\/[^\s<>"`\])，。]+/giu;

/**
 * Models routinely shorten a cited documentation link at a path boundary
 * (`.../step-code/configuration` for `.../step-code/configuration/models`). That is a formatting
 * slip, not an invented source. Restore it only when the written text ends on a whole path segment
 * and the cited evidence offers exactly one extension. A bare origin or a half-written segment is
 * left alone: completing it would assert a specific page the model never named.
 */
function restoreTruncatedCitation(url: string, allowed: Set<string>): string {
	try {
		const parsed = new URL(url);
		if (parsed.pathname === "/") return url;
	} catch {
		return url;
	}
	const candidates = [...allowed].filter((candidate) => candidate.startsWith(`${url}/`) && candidate !== url);
	return candidates.length === 1 ? candidates[0] : url;
}

const FEEDBACK_KINDS = ["bug", "feature", "improve", "none", "unclear"];

function feedbackGuidance(feedbackKind: string): string {
	if (feedbackKind === "bug") return `\n\n反馈问题\n如果问题仍未解决，欢迎提交反馈，我们会尽快排查。\n${BUG_TEMPLATE}`;
	if (feedbackKind === "feature")
		return `\n\n提交建议\n如果这正是您需要的能力，欢迎提交建议，我们会评估跟进。\n${FEATURE_TEMPLATE}`;
	if (feedbackKind === "improve") return `\n\n${IMPROVE_HINT}`;
	if (feedbackKind === "unclear") return "\n\n下一步\n你是遇到了已有功能异常，还是希望增加一种新的用法？";
	return "";
}

export function parseModelJson(value: string): unknown {
	const fenced = /^\s*```json\s*\n([\s\S]*?)\n```\s*$/u.exec(value);
	return JSON.parse(fenced ? fenced[1] : value);
}

/** Classification is the only field trusted from an answer that failed validation. */
function salvageFeedbackKind(value: string): string {
	try {
		const result: unknown = parseModelJson(value);
		if (
			result &&
			typeof result === "object" &&
			"feedbackKind" in result &&
			typeof result.feedbackKind === "string" &&
			FEEDBACK_KINDS.includes(result.feedbackKind)
		)
			return result.feedbackKind;
	} catch {}
	return "none";
}

export function validateGroundedAnswer(value: string, evidence: Evidence[], snapshot: string): string {
	try {
		const result: unknown = parseModelJson(value);
		if (!result || typeof result !== "object" || !("answer" in result) || !("sources" in result)) throw new Error();
		if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 3500) throw new Error();
		if (
			!Array.isArray(result.sources) ||
			!result.sources.every((id) => Number.isInteger(id) && evidence.some((item) => item.id === id))
		)
			throw new Error();
		if (containsSensitiveInput(result.answer)) throw new Error();
		if (
			!("feedbackKind" in result) ||
			typeof result.feedbackKind !== "string" ||
			!FEEDBACK_KINDS.includes(result.feedbackKind)
		)
			throw new Error();
		const guidance = feedbackGuidance(result.feedbackKind);
		// Retrieved chunks that do not cover the asked behavior are not citations. The answer text
		// is then ungrounded, so the host states the gap itself instead of relaying it.
		if (result.sources.length === 0)
			return `这是 Step Code 相关问题，但现有官方文档没有这项行为或能力的说明，暂时不能确认结论。${guidance}`;
		const ids: unknown[] = result.sources;
		const sources = evidence.filter((item) => ids.includes(item.id));
		const allowedUrls = new Set(sources.flatMap((item) => item.text.match(URL_PATTERN) ?? []));
		const urls = result.answer.match(URL_PATTERN) ?? [];
		// Product name is "Step Code"; the model sometimes writes it without the space.
		let answerText = result.answer.replace(/\bStep-?Code\b/gu, "Step Code");
		for (const url of new Set(urls)) {
			if (allowedUrls.has(url)) continue;
			const restored = restoreTruncatedCitation(url, allowedUrls);
			if (restored === url) throw new Error();
			answerText = answerText.replaceAll(url, restored);
		}
		if (!evidence.length)
			return `这是 Step Code 相关问题，但当前知识快照没有这项能力的资料，暂时不能确认是否支持。可以提供你看到的功能说明进一步核对。${guidance}`;
		return `${answerText.trim()}\n\n来源（知识快照 ${snapshot}）：\n${sources.map((item) => `${item.path}:L${item.line}`).join("\n")}${guidance}`;
	} catch {
		const guidance = feedbackGuidance(salvageFeedbackKind(value));
		return `这是 Step Code 相关问题，但本次回答的来源或格式未通过校验，暂时不能确认结论。${guidance || "可以换个说法重问，或补充具体操作场景。"}`;
	}
}
