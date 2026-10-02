import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCloudflareEnv, getDb } from "@/lib/cloudflare";
import { decryptBotToken } from "@/lib/bot-token";
import { sendVpsAction } from "@/lib/vps";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const db = await getDb();
    const bot = await db.prepare(
      `SELECT id, name, runtime, status, discord_bot_id, token_ciphertext
       FROM bots WHERE id = ? AND user_id = ? LIMIT 1`
    ).bind(id, userId).first<{
      id: string;
      name: string;
      runtime: "python" | "node";
      status: string;
      discord_bot_id: string | null;
      token_ciphertext: string | null;
    }>();

    if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
    if (!bot.token_ciphertext) {
      return NextResponse.json({ error: "This bot has no stored connection token." }, { status: 409 });
    }

    const env = await getCloudflareEnv();
    const token = await decryptBotToken(bot.token_ciphertext, env.BOT_TOKEN_ENCRYPTION_KEY);

    await sendVpsAction({
      action: "start",
      botId: bot.id,
      token,
      runtime: bot.runtime,
      name: bot.name,
      discordBotId: bot.discord_bot_id || undefined
    });

    await db.prepare(
      `UPDATE bots
       SET status = 'running', connection_status = 'connected', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).bind(id, userId).run();

    return NextResponse.json({ ok: true, status: "running" });
  } catch (error) {
    console.error("bots:start", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the bot." },
      { status: 503 }
    );
  }
}
