import { desktopRecordUrl } from "./desktop-feedback.ts";
import { wishRecordUrl } from "./wish.ts";

// Appended to answers for open-ended dissatisfaction: existing options are given first,
// then the user can turn remaining needs into a proposal.
export const IMPROVE_HINT = [
	"还不满意？",
	"如果以上方案仍不能满足你的需求，可以发送 /feature 获取模板提交需求，我们会审核并排期跟进。",
].join("\n");

const FEEDBACK_ID_PLACEHOLDER = "（选填，获取方式见下方）";

export const FEEDBACK_ID_GUIDE = [
	"如何获取 Feedback ID（选填，填写后能帮我们更快定位问题）：",
	"1. 在 Step Code 客户端的对话输入框输入 /feedback，按提示提交（提交前请检查是否含敏感信息）。",
	"2. 提交成功后，客户端会显示 Feedback ID，复制填到上面的 Feedback ID 一行即可。",
	"暂时拿不到 ID 也没关系，直接描述问题即可。",
].join("\n");

export const FEATURE_TEMPLATE = [
	"功能建议模板",
	"复制下面内容，用自己的话填好后发送：",
	"/feature",
	"想要的功能：（希望 Step Code 增加什么）",
	"使用场景：（什么时候需要，遇到什么不方便）",
	"希望怎么用：（希望怎样操作、得到什么结果）",
	"",
	"提交后我们会收集您的建议，并由团队评估跟进。描述中请勿包含密钥或私有代码。",
].join("\n");

export const BUG_TEMPLATE = [
	"问题反馈模板",
	"复制下面内容，用自己的话填好后发送：",
	"/bug",
	"遇到的问题：（Step Code 哪里不正常）",
	"当时做了什么：（问题出现前的操作）",
	"原本希望怎样：（你期待的正常结果）",
	`Feedback ID：${FEEDBACK_ID_PLACEHOLDER}`,
	"",
	FEEDBACK_ID_GUIDE,
	"",
	"提交后我们会收集这个问题，并由团队尽快排查跟进。描述中请勿包含密钥或私有代码。",
].join("\n");

export const COMMAND_HELP = [
	"Step Code助手只回答 Step Code 的使用问题，并收集问题反馈和功能建议，不执行 shell。",
	"/help：查看帮助",
	"/new：清空当前对话（群里为当前话题）的上下文，不删除已登记反馈",
	"/bug：获取问题反馈模板；/bug <描述>：提交问题",
	"/feature：获取功能建议模板；/feature <描述>：提交功能建议",
	"/desktop <问题描述>：反馈 Step Code 桌面端（客户端应用）的问题，自动记录到桌面端反馈表",
	"/wish <愿望描述>：许一个 Step Code 相关的愿望，自动记录到许愿表",
	"/diagnose <Feedback ID>：根据反馈 ID 拉取会话包，给出初步诊断",
	"/status：查看服务状态",
	"在群里 @我 提问，回复在话题里；同一话题内大家共享追问上下文。",
].join("\n");

export const DESKTOP_USAGE = [
	"用法：/desktop <问题描述>",
	"用于反馈 Step Code 桌面端（客户端应用）的问题，提交后自动记录到桌面端反馈表，消息里的截图会一并存档。",
	"描述请写清：现象、做了什么操作、期望的结果。请勿包含密钥或私有代码。",
].join("\n");

export const WISH_USAGE = [
	"用法：/wish <愿望描述>",
	"许一个 Step Code 相关的愿望（想要的功能、想改进的体验），提交后自动记录到许愿表，消息里的截图会一并存档。",
	"请勿包含密钥或私有代码。",
].join("\n");

export function attachmentNote(attached: number | null): string {
	return attached === null
		? "\n消息里的图片/文件未能自动附加，可打开记录手动上传。"
		: attached > 0
			? `\n已附 ${attached} 个图片/文件。`
			: "";
}

/** Shared reply builder for the /desktop command and the triage desktop route. */
export function desktopFeedbackReply(
	result: {
		recordId: string;
		attached: number | null;
		status: string;
		assigned?: { id: string; name: string };
		suspectedDuplicate?: { recordId: string; reason: string };
	},
	prefix: string,
): string {
	const assignmentNote =
		result.status !== "未处理"
			? `\n状态：${result.status}${result.assigned ? `｜Dev 负责人：${result.assigned.name}` : "｜Dev 负责人未识别，请在表格手动指派"}`
			: "";
	const duplicateNote = result.suspectedDuplicate
		? `\n疑似与已有问题重复${result.suspectedDuplicate.reason ? `（${result.suspectedDuplicate.reason}）` : ""}：\n${desktopRecordUrl(result.suspectedDuplicate.recordId)}\n确认同题后请在表格归并：父记录指向该主记录、状态置「重复」。`
		: "";
	return `${prefix}\n${desktopRecordUrl(result.recordId)}${attachmentNote(result.attached)}${assignmentNote}${duplicateNote}`;
}

/** Shared reply builder for the /wish command and the triage wish route. */
export function wishFeedbackReply(result: { recordId: string; attached: number | null }, prefix: string): string {
	return `${prefix}\n${wishRecordUrl(result.recordId)}${attachmentNote(result.attached)}`;
}

/** The diagnostics dashboard issues UUID feedback IDs; the shape is fixed before any request is made. */
export const FEEDBACK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const DIAGNOSE_USAGE = [
	"用法：/diagnose <Feedback ID>",
	"Feedback ID 在 Step Code 客户端提交反馈后返回，形如 123e4567-e89b-42d3-a456-426614174000。",
	"诊断会拉取该反馈对应的会话包并给出初步分析结论，同一 ID 的结果会缓存，不会重复分析。",
].join("\n");

export type SupportCommand =
	| { type: "help" | "new" | "status" }
	| { type: "feedback"; kind: "Bug" | "Feature"; description: string; feedbackId?: string }
	| { type: "feature-template" | "bug-template" }
	| { type: "desktop"; description: string }
	| { type: "desktop-template" }
	| { type: "wish"; description: string }
	| { type: "wish-template" }
	| { type: "diagnose"; feedbackId: string }
	| { type: "invalid"; message: string };

/**
 * Read an optional client Feedback ID from a "Feedback ID：" line in the description.
 * The client owns the ID format, so only transport-safe bounds are enforced; the
 * template placeholder and anything that is not one opaque token are ignored.
 */
export function extractFeedbackId(description: string): string | undefined {
	const match = /^\s*feedback\s*id\s*[：:]\s*(.*)$/imu.exec(description);
	const value = match?.[1].trim();
	if (!value || value === FEEDBACK_ID_PLACEHOLDER || value.length > 256 || /[\p{C}\s（）()]/u.test(value)) {
		return undefined;
	}
	return value;
}

export function parseSupportCommand(text: string): SupportCommand | undefined {
	const input = text.trim();
	if (!input.startsWith("/")) return undefined;
	const [name, ...words] = input.split(/\s+/u);
	if (name === "/help" || name === "/new" || name === "/status") {
		if (words.length) return { type: "invalid", message: `${name} 不接受参数。` };
		return { type: name.slice(1) as "help" | "new" | "status" };
	}
	if (name === "/bug" || name === "/feature") {
		const value = input.slice(name.length).trim();
		const placeholder = name === "/bug" ? "（Step Code 哪里不正常）" : "（希望 Step Code 增加什么）";
		if (!value || value.includes(placeholder)) {
			return { type: name === "/bug" ? "bug-template" : "feature-template" };
		}
		if (value.length > 4000) return { type: "invalid", message: "描述最多 4000 字，请精简后重新发送。" };
		const feedbackId = extractFeedbackId(value);
		return {
			type: "feedback",
			kind: name === "/bug" ? "Bug" : "Feature",
			description: value,
			...(feedbackId ? { feedbackId } : {}),
		};
	}
	if (name === "/desktop") {
		const value = input.slice(name.length).trim();
		if (!value) return { type: "desktop-template" };
		if (value.length > 4000) return { type: "invalid", message: "描述最多 4000 字，请精简后重新发送。" };
		return { type: "desktop", description: value };
	}
	if (name === "/wish") {
		const value = input.slice(name.length).trim();
		if (!value) return { type: "wish-template" };
		if (value.length > 4000) return { type: "invalid", message: "描述最多 4000 字，请精简后重新发送。" };
		return { type: "wish", description: value };
	}
	if (name === "/diagnose") {
		if (words.length === 0) return { type: "invalid", message: DIAGNOSE_USAGE };
		if (words.length > 1)
			return { type: "invalid", message: `/diagnose 只接受一个 Feedback ID 参数。\n${DIAGNOSE_USAGE}` };
		if (!FEEDBACK_ID_PATTERN.test(words[0]))
			return {
				type: "invalid",
				message: `Feedback ID 格式不正确，应形如 123e4567-e89b-42d3-a456-426614174000。\n${DIAGNOSE_USAGE}`,
			};
		return { type: "diagnose", feedbackId: words[0].toLowerCase() };
	}
	if (name === "/feedback") {
		// /feedback is the Step Code client command that produces a Feedback ID; registration here is /bug or /feature.
		return {
			type: "invalid",
			message:
				"/feedback 是 Step Code 客户端里的命令，用来提交反馈并获得 Feedback ID。在这里提交问题请用 /bug，提交功能建议请用 /feature。",
		};
	}
	return { type: "invalid", message: "未知命令，不会执行。发送 /help 查看支持的命令。" };
}

export interface CommandState {
	feedback?: { recordId: string };
}

export interface CommandContext {
	/** Host-generated tenant/user/chat/thread scope, never supplied by the model. */
	conversationKey: string;
	/** Host-generated follow-up memory scope: a whole group thread, or the person in private chat. */
	memoryKey: string;
	/** Host-generated delivery origin of the triggering message, never supplied by the model. */
	origin: { chatType: "p2p" | "group"; userId: string; chatId: string; threadId?: string };
	/** Other people @mentioned in the triggering message, never the bot itself. */
	mentions: { id: string; name: string }[];
	messageId: string;
	state: CommandState;
}

export interface CommandActions {
	resetContext(conversationKey: string): Promise<void>;
	saveState(conversationKey: string, state: CommandState): Promise<void>;
	status(): Promise<string>;
	registerFeedback(input: {
		conversationKey: string;
		messageId: string;
		kind: "Bug" | "Feature";
		description: string;
		feedbackId?: string;
	}): Promise<{ recordId: string }>;
	/** Write a desktop-client report to the desktop feedback table and sync its attachments. */
	registerDesktopFeedback?(input: {
		conversationKey: string;
		messageId: string;
		description: string;
		origin: { chatType: "p2p" | "group"; userId: string; chatId: string; threadId?: string };
		mentions: { id: string; name: string }[];
	}): Promise<{
		recordId: string;
		attached: number | null;
		status: string;
		assigned?: { id: string; name: string };
		suspectedDuplicate?: { recordId: string; reason: string };
	}>;
	/** Record a wish: wisher, description and the message's attachments. */
	registerWish?(input: {
		conversationKey: string;
		messageId: string;
		description: string;
		origin: { chatType: "p2p" | "group"; userId: string; chatId: string; threadId?: string };
	}): Promise<{ recordId: string; attached: number | null }>;
	/** Pull the feedback session bundle from the diagnostics dashboard and produce a preliminary diagnosis. */
	diagnose?(feedbackId: string): Promise<string>;
}

/** Run before any LLM request. Returning undefined delegates an ordinary question. */
export async function handleSupportCommand(
	text: string,
	context: CommandContext,
	actions: CommandActions,
): Promise<string | undefined> {
	const command = parseSupportCommand(text);
	if (!command) return undefined;
	const { conversationKey, messageId, state } = context;
	switch (command.type) {
		case "feature-template":
			return FEATURE_TEMPLATE;
		case "bug-template":
			return BUG_TEMPLATE;
		case "desktop-template":
			return DESKTOP_USAGE;
		case "wish-template":
			return WISH_USAGE;
		case "invalid":
			return command.message;
		case "help":
			return COMMAND_HELP;
		case "status":
			return actions.status();
		case "diagnose":
			return actions.diagnose ? await actions.diagnose(command.feedbackId) : "诊断功能当前未启用。";
		case "desktop": {
			if (!actions.registerDesktopFeedback) return "桌面端反馈功能当前未启用。";
			const result = await actions.registerDesktopFeedback({
				conversationKey,
				messageId,
				description: command.description,
				origin: context.origin,
				mentions: context.mentions,
			});
			return desktopFeedbackReply(result, "已记录桌面端问题，可点击查看：");
		}
		case "wish": {
			if (!actions.registerWish) return "许愿功能当前未启用。";
			const result = await actions.registerWish({
				conversationKey,
				messageId,
				description: command.description,
				origin: context.origin,
			});
			return wishFeedbackReply(result, "愿望已记录，感谢许愿！可点击查看：");
		}
		case "new":
			await actions.resetContext(context.memoryKey);
			await actions.saveState(conversationKey, {});
			return "已清空当前对话上下文。已提交的反馈不会删除。";
		case "feedback": {
			const { recordId } = await actions.registerFeedback({
				conversationKey,
				messageId,
				kind: command.kind,
				description: command.description,
				...(command.feedbackId ? { feedbackId: command.feedbackId } : {}),
			});
			await actions.saveState(conversationKey, { ...state, feedback: { recordId } });
			if (command.kind === "Feature") return "已收到您的功能建议，团队会评估并跟进。感谢反馈。";
			if (command.feedbackId) {
				return `已收到您反馈的问题，并记录了 Feedback ID ${command.feedbackId}，团队会尽快排查跟进。感谢反馈。`;
			}
			return "已收到您反馈的问题，团队会尽快排查跟进。感谢反馈。\n如果方便，下次可以附上 Feedback ID（在 Step Code 客户端输入 /feedback 提交后获得），能帮我们更快定位问题。";
		}
	}
}
