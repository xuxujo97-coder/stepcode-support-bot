const event = {
	type: "im.message.receive_v1",
	chat_type: "p2p",
	sender_type: "user",
	message_type: "text",
	sender_id: "ou_user",
	chat_id: "oc_chat",
	message_id: "om_fixture",
	content: "/help",
};
process.stdout.write(`${JSON.stringify(event)}\n`);
setTimeout(() => {
	process.stderr.write("[event] ready event_key=im.message.receive_v1\n");
}, 50);
process.stdin.resume();
process.on("SIGTERM", () => process.exit(0));
