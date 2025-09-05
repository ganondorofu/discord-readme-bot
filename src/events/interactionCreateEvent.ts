import { type CacheType, type Interaction, MessageFlags, type StringSelectMenuInteraction, type ButtonInteraction, EmbedBuilder } from "discord.js";
import { commands } from "../commands";
import { COMMAND_NAME } from "../config";
import { buildErrorEmbed } from "../utils/embedUtils";

/**
 * インタラクションイベントハンドラー
 */
export async function interactionCreateEventHandler(
	interaction: Interaction<CacheType>,
): Promise<void> {
	try {
		if (interaction.isChatInputCommand()) {
			if (interaction.commandName !== COMMAND_NAME) return;

			// サーバーが存在しない場合、またはインタラクションがサーバー外で発生した場合
			if (!interaction.guild) {
				await interaction.reply({
					embeds: [buildErrorEmbed("このコマンドはサーバー内でのみ使用できます。")],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			// サブコマンドを実行
			const subcommand = interaction.options.getSubcommand();
			for (const cmd of commands) {
				if (cmd.name === subcommand) {
					await cmd.execute(interaction);
					return;
				}
			}

			// サブコマンドが見つからない場合
			await interaction.reply({
				content: `コマンド「/${COMMAND_NAME} ${subcommand}」は存在しません。`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (interaction.isStringSelectMenu()) {
			await handleStringSelectMenu(interaction);
			return;
		}

		if (interaction.isButton()) {
			await handleButton(interaction);
			return;
		}
	} catch (error) {
		console.error('インタラクション処理中にエラーが発生しました:', error);
		
		// エラーレスポンスを送信（まだ応答していない場合のみ）
		if (interaction.isRepliable() && !interaction.replied) {
			try {
				await interaction.reply({
					embeds: [buildErrorEmbed("インタラクション処理中にエラーが発生しました。")],
					flags: MessageFlags.Ephemeral,
				});
			} catch (replyError) {
				console.error('エラーレスポンスの送信に失敗しました:', replyError);
			}
		}
	}
}

/**
 * 文字列選択メニューのインタラクションを処理
 */
async function handleStringSelectMenu(interaction: StringSelectMenuInteraction<CacheType>) {
	try {
		if (!interaction.customId.startsWith('role_select_')) return;

		const parts = interaction.customId.split('_');
		if (parts.length < 3 || parts[1] !== 'select') return;

		// 選択されたロールを保存（一時的にメッセージに保存）
		const selectedRoles = interaction.values;

		// 確認メッセージを表示
		const embed = new EmbedBuilder()
			.setTitle("ロール選択確認")
			.setDescription(`選択されたロール: ${selectedRoles.map(id => `<@&${id}>`).join(', ')}\n\nOKボタンを押して確定してください。`)
			.setColor(0x5865f2);

		await interaction.update({ embeds: [embed] });
	} catch (error) {
		console.error('文字列選択メニュー処理中にエラーが発生しました:', error);
		if (!interaction.replied) {
			try {
				await interaction.reply({
					embeds: [buildErrorEmbed("ロール選択処理中にエラーが発生しました。")],
					flags: MessageFlags.Ephemeral,
				});
			} catch (replyError) {
				console.error('エラーレスポンスの送信に失敗しました:', replyError);
			}
		}
	}
}

/**
 * ボタンのインタラクションを処理
 */
async function handleButton(interaction: ButtonInteraction<CacheType>) {
	try {
		if (interaction.customId === 'role_cancel') {
			await interaction.update({ content: 'キャンセルされました。', embeds: [], components: [] });
			return;
		}

		if (!interaction.customId.startsWith('role_confirm_')) return;

		const parts = interaction.customId.split('_');
		if (parts.length < 5 || parts[1] !== 'confirm') return;

		const messageId = parts[3];
		const filterMode = parts[4];

		// 選択されたロールを取得（メッセージから）
		const embed = interaction.message.embeds[0];
		if (!embed || !embed.description) return;

		const roleMatches = embed.description.match(/<@&(\d+)>/g);
		if (!roleMatches) return;

		const selectedRoleIds = roleMatches.map(match => match.replace('<@&', '').replace('>', ''));

		// ここでcheckまたはremindの処理を実行
		if (interaction.customId.includes('_check_')) {
			await executeCheckCommand(interaction, messageId, filterMode, selectedRoleIds);
		} else if (interaction.customId.includes('_remind_')) {
			await executeRemindCommand(interaction, messageId, filterMode, selectedRoleIds);
		}
	} catch (error) {
		console.error('ボタン処理中にエラーが発生しました:', error);
		if (!interaction.replied) {
			try {
				await interaction.reply({
					embeds: [buildErrorEmbed("ボタン処理中にエラーが発生しました。")],
					flags: MessageFlags.Ephemeral,
				});
			} catch (replyError) {
				console.error('エラーレスポンスの送信に失敗しました:', replyError);
			}
		}
	}
}/**
 * checkコマンドの実行
 */
async function executeCheckCommand(
	interaction: ButtonInteraction<CacheType>,
	messageId: string,
	filterMode: string,
	selectedRoleIds: string[]
) {
	// 処理が長くなる可能性があるので、deferReplyを追加
	await interaction.deferUpdate();

	try {
		// checkCommand.tsのロジックをここにコピーして実行
		const guild = interaction.guild;
		if (!guild) return;

		const { findMessageInGuild, getTargetUsers } = await import("../utils/messageUtils.js");

		const message = await findMessageInGuild(guild, messageId);
		if (!message) {
			await interaction.editReply({ content: 'メッセージが見つかりません。', embeds: [], components: [] });
			return;
		}

		const targetUsers = await getTargetUsers(message);
		const reactedUsers = new Set();
		for (const reaction of message.reactions.cache.values()) {
			const users = await reaction.users.fetch();
			for (const user of users.values()) {
				if (user.bot || message.author === user) continue;
				reactedUsers.add(user);
			}
		}

		let filteredUsers = targetUsers;
		if (selectedRoleIds.length > 0) {
			await guild.members.fetch();
			filteredUsers = targetUsers.filter((user: any) => {
				const member = guild.members.cache.get(user.id);
				if (!member) return false;

				if (filterMode === "and") {
					return selectedRoleIds.every(roleId => member.roles.cache.has(roleId));
				}
				return selectedRoleIds.some(roleId => member.roles.cache.has(roleId));
			});
		}

		const readUsers = filteredUsers.filter((user: any) => reactedUsers.has(user));
		const unreadUsers = filteredUsers.filter((user: any) => !reactedUsers.has(user));

		const embed = new EmbedBuilder()
			.setTitle("📋 既読状況確認")
			.setColor(0x5865f2)
			.setTimestamp()
			.addFields([
				{
					name: `✅ 既読 (${readUsers.length}人)`,
					value: readUsers.length > 0 ? readUsers.slice(0, 20).map((user: any) => `<@${user.id}>`).join(", ") : "なし",
					inline: false,
				},
				{
					name: `❌ 未読 (${unreadUsers.length}人)`,
					value: unreadUsers.length > 0 ? unreadUsers.slice(0, 20).map((user: any) => `<@${user.id}>`).join(", ") : "なし",
					inline: false,
				},
			]);

		if (selectedRoleIds.length > 0) {
			const roleNames = selectedRoleIds.map(id => guild.roles.cache.get(id)?.name).filter(Boolean).join(", ");
			const modeText = filterMode === "and" ? "AND" : "OR";
			embed.setDescription(`🔍 フィルター: ${roleNames} (${modeText}条件) (${filteredUsers.length}/${targetUsers.length}人)`);
		}

		await interaction.editReply({ embeds: [embed], components: [] });
	} catch (error) {
		console.error('checkコマンド実行中にエラーが発生しました:', error);
		await interaction.editReply({
			content: 'チェック処理中にエラーが発生しました。',
			embeds: [],
			components: []
		});
	}
}

/**
 * remindコマンドの実行
 */
async function executeRemindCommand(
	interaction: ButtonInteraction<CacheType>,
	messageId: string,
	filterMode: string,
	selectedRoleIds: string[]
) {
	// 処理が長くなる可能性があるので、deferReplyを追加
	await interaction.deferUpdate();

	try {
		// remindCommand.tsのロジックをここにコピーして実行
		const guild = interaction.guild;
		if (!guild) return;

		const { findMessageInGuild, getTargetUsers } = await import("../utils/messageUtils.js");
		const { buildSuccessEmbed } = await import("../utils/embedUtils.js");

		const message = await findMessageInGuild(guild, messageId);
		if (!message) {
			await interaction.editReply({ content: 'メッセージが見つかりません。', embeds: [], components: [] });
			return;
		}

	const targetUsers = await getTargetUsers(message);
	const reactedUsers = new Set();
	for (const reaction of message.reactions.cache.values()) {
		const users = await reaction.users.fetch();
		for (const user of users.values()) {
			if (user.bot || message.author === user) continue;
			reactedUsers.add(user);
		}
	}

	let filteredUsers = targetUsers;
	if (selectedRoleIds.length > 0) {
		await guild.members.fetch();
		filteredUsers = targetUsers.filter((user: any) => {
			const member = guild.members.cache.get(user.id);
			if (!member) return false;

			if (filterMode === "and") {
				return selectedRoleIds.every(roleId => member.roles.cache.has(roleId));
			}
			return selectedRoleIds.some(roleId => member.roles.cache.has(roleId));
		});
	}

	const unreadUsers = filteredUsers.filter((user: any) => !reactedUsers.has(user));

	if (unreadUsers.length === 0) {
		const embed = new EmbedBuilder()
			.setTitle("ℹ️ 情報")
			.setDescription("未読のユーザーはいません。")
			.setColor(0x5865f2);
		await interaction.update({ embeds: [embed], components: [] });
		return;
	}

	// リマインダー送信
	for (const user of unreadUsers) {
		try {
			const reminderEmbed = new EmbedBuilder()
				.setTitle("📝 未読メッセージのお知らせ")
				.setDescription("以下のメッセージがまだ未読です。確認をお願いします。")
				.setColor(0x5865f2)
				.addFields(
					{ name: "📍 チャンネル", value: `<#${message.channel.id}>` },
					{ name: "👤 投稿者", value: `<@${message.author.id}>` },
					{
						name: "📅 投稿日時",
						value: `<t:${Math.floor(message.createdTimestamp / 1000)}:f>`,
						inline: true,
					},
					{
						name: "💬 メッセージ内容",
						value: message.content
							? message.content.length > 100
								? `${message.content.substring(0, 100)}...`
								: message.content
							: "*埋め込みまたは添付ファイル*",
						inline: false,
					},
				)
				.setFooter({
					text: "メッセージ確認後、👀リアクションをつけてください",
				})
				.setTimestamp();

			await user.send({
				embeds: [reminderEmbed],
				components: [
					{
						type: 1,
						components: [
							{
								type: 2,
								style: 5,
								label: "メッセージを確認する",
								url: message.url,
								emoji: { name: "🔗" },
							},
						],
					},
				],
			});
		} catch (error) {
			console.error(`Failed to send reminder to ${user.displayName}:`, error);
		}
	}

	const embed = buildSuccessEmbed(
		selectedRoleIds.length > 0
			? `${selectedRoleIds.map(id => guild.roles.cache.get(id)?.name).filter(Boolean).join(", ")}ロール（${filterMode === "and" ? "AND" : "OR"}条件）の未読者 ${unreadUsers.length}人にリマインダーを送信しました。`
			: `未読者 ${unreadUsers.length}人にリマインダーを送信しました。`
	);

	await interaction.editReply({ embeds: [embed], components: [] });
	} catch (error) {
		console.error('remindコマンド実行中にエラーが発生しました:', error);
		await interaction.editReply({
			content: 'リマインダー処理中にエラーが発生しました。',
			embeds: [],
			components: []
		});
	}
}
