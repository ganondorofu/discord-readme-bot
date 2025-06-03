import { EmbedBuilder, MessageFlags, type User } from "discord.js";
import type { Command } from ".";
import { ERROR_COLOR, INFO_COLOR } from "../config";
import { getTargetUsers } from "../utils/messageUtils";

export const checkCommandHandler: Command = {
	name: "check",
	description: "指定メッセージの既読状況を確認する",
	aliases: ["c"],
	execute: async (interaction) => {
		const messageId = interaction.options.getString("message_id");
		if (!messageId) {
			const embed = new EmbedBuilder()
				.setTitle("❌ エラー")
				.setDescription("メッセージIDが指定されていません。")
				.setColor(ERROR_COLOR);
			await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
			return;
		}

		// チャンネルを取得
		const channel = interaction.channel;
		if (!channel) {
			const embed = new EmbedBuilder()
				.setTitle("❌ エラー")
				.setDescription("メッセージを取得するチャンネルが見つかりません。")
				.setColor(ERROR_COLOR);
			await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
			return;
		}

		// messageIdからメッセージを取得
		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) {
			const embed = new EmbedBuilder()
				.setTitle("❌ エラー")
				.setDescription("指定されたメッセージが見つかりません。")
				.setColor(ERROR_COLOR);
			await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
			return;
		}

		// リアクションしたユーザーを取得
		const reactedUsers = new Set<User>();
		for (const reaction of message.reactions.cache.values()) {
			const users = await reaction.users.fetch();
			for (const user of users.values()) {
				if (user.bot || message.author === user) continue;
				reactedUsers.add(user);
			}
		}

		// 既読・未読ユーザーの分類
		const targetUsers = await getTargetUsers(message);
		const readUsers = targetUsers.filter((user) => reactedUsers.has(user));
		const unreadUsers = targetUsers.filter((user) => !reactedUsers.has(user));

		// 結果をEmbedで表示
		const embed = new EmbedBuilder()
			.setTitle("📋 既読状況確認")
			.setColor(INFO_COLOR)
			.addFields(
				{
					name: `✅ 既読 (${readUsers.length}人)`,
					value:
						readUsers.length > 0 ? readUsers.map((user) => `<@${user.id}>`).join(", ") : "なし",
					inline: false,
				},
				{
					name: `❌ 未読 (${unreadUsers.length}人)`,
					value:
						unreadUsers.length > 0 ? unreadUsers.map((user) => `<@${user.id}>`).join(", ") : "なし",
					inline: false,
				},
			);

		await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
	},
};
