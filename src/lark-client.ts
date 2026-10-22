import { execFile } from "node:child_process";

export interface LarkClient {
	call(command: string, args: string[]): Promise<unknown>;
}

/**
 * Bitable writes the bot application cannot reach (no collaborator access) go out through the
 * operator's personal lark-cli profile: the default profile with --as user. Chat input can never
 * choose the identity, command or arguments.
 */
export interface LarkUserClient {
	callAsUser(command: string, args: string[]): Promise<unknown>;
}

/** A resource downloaded from one message into ./lark-im-resources/ under the service cwd. */
export interface MessageResource {
	messageId: string;
	key: string;
	type: "image" | "file";
	localPath: string;
}

/** Reads a received message's own downloadable resources (images, files; stickers excluded). */
export interface LarkResourceClient {
	fetchMessageResources(messageId: string): Promise<MessageResource[]>;
}

/** Fixed bot identity and executable; chat input can never choose a command. */
export class LarkCliClient implements LarkClient, LarkUserClient, LarkResourceClient {
	private static readonly BASE_COMMANDS = [
		"+record-batch-create",
		"+record-list",
		"+record-get",
		"+record-upload-attachment",
	];

	async call(command: string, args: string[]): Promise<unknown> {
		if (!LarkCliClient.BASE_COMMANDS.includes(command)) {
			throw new Error("Unsupported feedback operation");
		}
		return this.execute(["base", command, ...args, "--as", "bot", "--format", "json"]);
	}

	async callAsUser(command: string, args: string[]): Promise<unknown> {
		if (!LarkCliClient.BASE_COMMANDS.includes(command)) {
			throw new Error("Unsupported feedback operation");
		}
		return this.run(["base", command, ...args, "--as", "user", "--format", "json"], "user", 30000);
	}

	/**
	 * Downloads the message's resources as the bot and returns only the message's own refs —
	 * thread-reply expansion may attach other messages' resources, which are not ours to upload.
	 * The CLI reports absolute paths confined to <cwd>/lark-im-resources; only that directory is accepted.
	 */
	async fetchMessageResources(messageId: string): Promise<MessageResource[]> {
		if (!/^om_[A-Za-z0-9_-]{1,253}$/u.test(messageId)) throw new Error("Invalid resource message");
		const value = (await this.execute(
			[
				"im",
				"+messages-mget",
				"--message-ids",
				messageId,
				"--download-resources",
				"--no-reactions",
				"--as",
				"bot",
				"--format",
				"json",
			],
			false,
			60000,
		)) as { messages?: unknown } | null;
		const messages = Array.isArray(value?.messages) ? value?.messages : [];
		const own = messages.find(
			(item): item is { resources?: unknown } =>
				!!item && typeof item === "object" && (item as { message_id?: unknown }).message_id === messageId,
		);
		const resources = Array.isArray(own?.resources) ? own?.resources : [];
		const result: MessageResource[] = [];
		const directory = `${process.cwd()}/lark-im-resources/`;
		for (const ref of resources) {
			if (!ref || typeof ref !== "object" || (ref as { error?: unknown }).error === true) continue;
			const { message_id, key, type, local_path } = ref as Record<string, unknown>;
			if (message_id !== messageId) continue;
			if (typeof key !== "string" || typeof local_path !== "string" || (type !== "image" && type !== "file"))
				continue;
			if (local_path.includes("..") || !local_path.startsWith(directory)) continue;
			result.push({ messageId, key, type, localPath: local_path });
		}
		return result;
	}

	async verifyIdentity(): Promise<void> {
		const value = await this.execute(["whoami", "--as", "bot"], true);
		if (
			!value ||
			typeof value !== "object" ||
			!("appId" in value) ||
			value.appId !== "cli_aa5e555d4a395c00" ||
			!("identity" in value) ||
			value.identity !== "bot" ||
			!("available" in value) ||
			value.available !== true ||
			!("tokenStatus" in value) ||
			value.tokenStatus !== "ready"
		) {
			throw new Error("Dedicated bot profile identity is not ready");
		}
	}

	async reply(messageId: string, text: string, idempotencyKey: string, inThread = false): Promise<void> {
		if (
			!/^om_[A-Za-z0-9_-]+$/u.test(messageId) ||
			text.length > 5000 ||
			!text ||
			!/^[a-f0-9-]{36}$/u.test(idempotencyKey)
		) {
			throw new Error("Invalid bot reply");
		}
		await this.execute([
			"im",
			"+messages-reply",
			"--message-id",
			messageId,
			"--text",
			text,
			"--idempotency-key",
			idempotencyKey,
			...(inThread ? ["--reply-in-thread"] : []),
			"--as",
			"bot",
			"--format",
			"json",
		]);
	}

	async createWorkingReaction(messageId: string): Promise<string> {
		if (!/^om_[A-Za-z0-9_-]{1,253}$/u.test(messageId)) throw new Error("Invalid reaction message");
		const value = await this.execute(
			[
				"im",
				"reactions",
				"create",
				"--message-id",
				messageId,
				"--data",
				JSON.stringify({ reaction_type: { emoji_type: "OnIt" } }),
				"--as",
				"bot",
				"--format",
				"json",
			],
			false,
			5000,
		);
		if (
			!value ||
			typeof value !== "object" ||
			!("reaction_id" in value) ||
			typeof value.reaction_id !== "string" ||
			!/^[A-Za-z0-9_-]{1,512}$/u.test(value.reaction_id)
		) {
			throw new Error("Invalid working reaction response");
		}
		return value.reaction_id;
	}

	async removeWorkingReaction(messageId: string, reactionId: string): Promise<void> {
		if (!/^om_[A-Za-z0-9_-]{1,253}$/u.test(messageId) || !/^[A-Za-z0-9_-]{1,512}$/u.test(reactionId)) {
			throw new Error("Invalid working reaction identity");
		}
		await this.execute(
			[
				"im",
				"reactions",
				"delete",
				"--message-id",
				messageId,
				"--reaction-id",
				reactionId,
				"--as",
				"bot",
				"--format",
				"json",
			],
			false,
			5000,
		);
	}

	private async execute(args: string[], identity = false, timeout = 30000): Promise<unknown> {
		return this.run(["--profile", "step-code-bot", ...args], identity ? undefined : "bot", timeout);
	}

	private async run(argv: string[], expectedIdentity: "bot" | "user" | undefined, timeout: number): Promise<unknown> {
		const stdout = await new Promise<string>((resolve, reject) => {
			execFile(
				"lark-cli",
				argv,
				{
					timeout,
					maxBuffer: 2 * 1024 * 1024,
					env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" },
				},
				(error, output) => {
					// Do not surface CLI stderr, which may contain input data or authorization URLs.
					if (error) reject(new Error("Bot API failed; outcome requires reconciliation"));
					else resolve(output);
				},
			);
		});
		let envelope: unknown;
		try {
			envelope = JSON.parse(stdout);
		} catch {
			throw new Error("Invalid feedback API response");
		}
		if (expectedIdentity === undefined) return envelope;
		if (
			!envelope ||
			typeof envelope !== "object" ||
			!("ok" in envelope) ||
			envelope.ok !== true ||
			!("identity" in envelope) ||
			envelope.identity !== expectedIdentity ||
			!("data" in envelope)
		) {
			throw new Error(`Feedback API did not confirm ${expectedIdentity} success`);
		}
		return envelope.data;
	}
}
