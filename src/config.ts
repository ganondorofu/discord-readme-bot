import type { ColorResolvable } from "discord.js";
import { config } from "dotenv";

config();

// Discord Bot設定
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
export const CLIENT_ID = process.env.CLIENT_ID || "";
export const GUILD_ID = process.env.GUILD_ID || ""; // 開発用ギルドID（本番では空にする）
export const READ_REACTION_EMOJI = process.env.READ_REACTION_EMOJI || "👀";
export const COMMAND_NAME = process.env.COMMAND_NAME || "readme";

// サーバー設定
export const PORT = Number(process.env.PORT) || 8000;

// Embed色設定
export const INFO_COLOR: ColorResolvable = 0x3498db;
export const SUCCESS_COLOR: ColorResolvable = 0x2ecc71;
export const WARNING_COLOR: ColorResolvable = 0xf1c40f;
export const ERROR_COLOR: ColorResolvable = 0xe74c3c;
