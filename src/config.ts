import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

/** Fixed internal dashboard host; a configured override may not point anywhere else. */
const DEFAULT_DASHBOARD_BASE_URL = "https://stepcliobserserver-dashboard.stepfun-inc.com";

export interface SupportConfig {
	tenantId: string;
	/** Users allowed to use private chat; everyone else is redirected to the group. */
	allowedUsers: string[];
	/** Group chats where every member may @ the bot. */
	allowedChats: string[];
	/** Group chats where every message is triaged (classified, routed, replied) without @-ing the bot. */
	triageChats?: string[];
	/** The bot's own open_id, used to recognize @mentions of the bot in group messages. */
	botOpenId: string;
	stateDir: string;
	repositoryDir: string;
	apiKeyFile: string;
	dailyRequests: number;
	dashboardBaseUrl: string;
}

export function loadSupportConfig(path: string): SupportConfig {
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid support configuration");
	const config = value as Record<string, unknown>;
	for (const key of ["tenantId", "stateDir", "repositoryDir", "apiKeyFile"]) {
		if (typeof config[key] !== "string" || !config[key] || /[\p{C}]/u.test(config[key])) {
			throw new Error(`Missing or invalid configuration: ${key}`);
		}
	}
	if (
		!Array.isArray(config.allowedUsers) ||
		config.allowedUsers.length === 0 ||
		config.allowedUsers.length > 100 ||
		!config.allowedUsers.every((user) => typeof user === "string" && /^ou_[A-Za-z0-9_-]+$/u.test(user))
	)
		throw new Error("Configure an explicit user open-ID allowlist");
	if (
		!Array.isArray(config.allowedChats) ||
		config.allowedChats.length === 0 ||
		config.allowedChats.length > 100 ||
		!config.allowedChats.every((chat) => typeof chat === "string" && /^oc_[A-Za-z0-9_-]+$/u.test(chat))
	)
		throw new Error("Configure an explicit group chat-ID allowlist");
	if (
		config.triageChats !== undefined &&
		(!Array.isArray(config.triageChats) ||
			config.triageChats.length > 100 ||
			!config.triageChats.every((chat) => typeof chat === "string" && /^oc_[A-Za-z0-9_-]+$/u.test(chat)))
	)
		throw new Error("Configure triage chat IDs with the oc_ prefix");
	if (typeof config.botOpenId !== "string" || !/^ou_[A-Za-z0-9_-]+$/u.test(config.botOpenId))
		throw new Error("Configure the bot open ID");
	if (config.allowedUsers.includes(config.botOpenId)) throw new Error("The bot cannot be an allowed user");
	if (
		!Number.isSafeInteger(config.dailyRequests) ||
		Number(config.dailyRequests) < 1 ||
		Number(config.dailyRequests) > 1000
	) {
		throw new Error("dailyRequests must be an integer from 1 to 1000");
	}
	const dashboardBaseUrl =
		config.dashboardBaseUrl === undefined ? DEFAULT_DASHBOARD_BASE_URL : String(config.dashboardBaseUrl);
	let dashboardUrl: URL;
	try {
		dashboardUrl = new URL(dashboardBaseUrl);
	} catch {
		throw new Error("Invalid diagnostics dashboard base URL");
	}
	if (
		dashboardUrl.protocol !== "https:" ||
		dashboardUrl.hostname !== new URL(DEFAULT_DASHBOARD_BASE_URL).hostname ||
		dashboardUrl.pathname !== "/" ||
		dashboardUrl.search ||
		dashboardUrl.hash ||
		dashboardUrl.username ||
		dashboardUrl.password
	) {
		throw new Error("Diagnostics dashboard base URL must be the fixed internal host without path or credentials");
	}
	for (const key of ["stateDir", "repositoryDir", "apiKeyFile"]) {
		if (!isAbsolute(String(config[key]))) throw new Error(`${key} must be an absolute path`);
	}
	const stateDir = realpathSync(String(config.stateDir));
	const stateStat = statSync(stateDir);
	if (!stateStat.isDirectory() || (stateStat.mode & 0o077) !== 0 || stateStat.uid !== process.getuid?.()) {
		throw new Error("State directory must be owned by the service user with mode 0700");
	}
	const keyStat = statSync(String(config.apiKeyFile));
	if (!keyStat.isFile() || keyStat.size > 4096 || (keyStat.mode & 0o077) !== 0 || keyStat.uid !== process.getuid?.()) {
		throw new Error("API key file must be private, small and owned by the service user");
	}
	return {
		tenantId: String(config.tenantId),
		allowedUsers: config.allowedUsers,
		allowedChats: config.allowedChats,
		...(Array.isArray(config.triageChats) ? { triageChats: config.triageChats } : {}),
		botOpenId: config.botOpenId,
		stateDir,
		repositoryDir: realpathSync(String(config.repositoryDir)),
		apiKeyFile: String(config.apiKeyFile),
		dailyRequests: Number(config.dailyRequests),
		dashboardBaseUrl: dashboardUrl.origin,
	};
}

const CREDENTIAL_PATTERNS = [
	/-----BEGIN .*PRIVATE KEY-----/iu,
	/\b(?:sk|pat|ghp|gho)-[A-Za-z0-9_-]{16,}/u,
	/\bgh[pousr]_[A-Za-z0-9]{20,}/u,
];

const CREDENTIAL_ASSIGNMENT =
	/(?:api[_ -]?key|app[_ -]?secret|access[_ -]?token|authorization|密码|密钥)\s*[=:：]\s*(\S{8,})/iu;

/**
 * Documentation and shell examples write values like `<your_step_api_key>`, not real secrets.
 * Treating them as credentials lost otherwise valid answers that quote the product docs.
 */
function isPlaceholderValue(value: string): boolean {
	return /^(?:<|\$\{|\{\{|your[_-]|YOUR[_-]|\*+|\.{3})/u.test(value);
}

export function containsSensitiveInput(text: string): boolean {
	if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text))) return true;
	const assignment = CREDENTIAL_ASSIGNMENT.exec(text);
	if (!assignment) return false;
	return !isPlaceholderValue(assignment[1]);
}
