// import { serve } from "@hono/node-server";
// import { ActivityType, Client, Gateway// Koyeb用のヘルスチェックサーバーを起動
// https://www.koyeb.com/docs/run-and-scale/health-checks
console.log("🌐 ヘルスチェックサーバーを起動中...");
// serve(healthCheckServer, { port: PORT });
console.log("✅ ヘルスチェックサーバーが起動しました");
console.log(`🔗 ヘルスチェックURL: http://localhost:${PORT}`);
// startHealthCheckCron();its, Partials, REST, Routes } from "discord.js";
import { ActivityType, Client, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { slashCommandData } from "./commands";
import { CLIENT_ID, DISCORD_TOKEN, GUILD_ID, PORT } from "./config";
import { startHealthCheckCron } from "./cron";
import { interactionCreateEventHandler } from "./events/interactionCreateEvent";
import { messageCreateEventHandler } from "./events/messageCreateEvent";
import { messageReactionAddEventHandler } from "./events/messageReactionAddEvent";
import { messageUpdateEventHandler } from "./events/messageUpdateEvent";
// import healthCheckServer from "./server";

// トークンが設定されていない場合は終了
if (!DISCORD_TOKEN) {
	console.error("❌ エラー: DISCORD_TOKENが設定されていません");
	console.error("💡 .envファイルでDISCORD_TOKENを設定してください");
	process.exit(1);
}

const client: Client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

console.log("🤖 BOTを起動中...");

client.login(DISCORD_TOKEN);

client.on("ready", async () => {
	console.log("✅ BOTがログインしました");
	console.log("🔄 スラッシュコマンドを登録中...");
	const rest = new REST().setToken(DISCORD_TOKEN);

	try {
		if (GUILD_ID) {
			// 開発用：特定のギルドにのみ登録（即座に反映される）
			await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
				body: [slashCommandData.toJSON()],
			});
			console.log(`✅ ギルド固有のスラッシュコマンドを登録しました (Guild ID: ${GUILD_ID})`);
		} else {
			// 本番用：グローバルに登録（反映に時間がかかる場合がある）
			await rest.put(Routes.applicationCommands(CLIENT_ID), {
				body: [slashCommandData.toJSON()],
			});
			console.log("✅ グローバルスラッシュコマンドを登録しました");
		}
	} catch (error) {
		console.error("❌ スラッシュコマンドの登録に失敗しました:", error);
	}

	console.log("✅ BOTが正常に起動しました！");
	console.log("============== BOT情報 ==============");
	console.log(`ID: ${client.user?.id}`);
	console.log(`ユーザー名: ${client.user?.tag}`);
	client.user?.setActivity(`/${slashCommandData.name} help`, {
		type: ActivityType.Watching,
	});
});

client.on("error", (error) => {
	console.error("❌ BOTでエラーが発生しました:");
	console.error("エラー詳細:", error.message);
	console.error("スタックトレース:", error.stack);
});

client.on("disconnect", () => {
	console.warn("⚠️ Discordから切断されました");
});

client.on("reconnecting", () => {
	console.log("🔄 Discordへの再接続を試行中...");
});

// イベントハンドラーを登録
client.on("messageCreate", messageCreateEventHandler);
client.on("messageUpdate", messageUpdateEventHandler);
client.on("messageReactionAdd", messageReactionAddEventHandler);
client.on("interactionCreate", interactionCreateEventHandler);

// Koyeb用のヘルスチェックサーバーを起動
// https://www.koyeb.com/docs/run-and-scale/health-checks
console.log("🌐 ヘルスチェックサーバーを起動中...");
// serve(healthCheckServer, { port: PORT });
console.log("✅ ヘルスチェックサーバーが起動しました");
console.log(`🔗 ヘルスチェックURL: http://localhost:${PORT}`);
startHealthCheckCron();
