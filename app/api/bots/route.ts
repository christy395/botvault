import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCloudflareEnv, getDb } from "@/lib/cloudflare";
import { encryptBotToken } from "@/lib/bot-token";

type DiscordBotUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
};

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const { results } = await db.prepare(
      `SELECT id, name, runtime, status, connection_status, discord_bot_id, discord_username,
              discord_avatar, created_at, updated_at
       FROM bots WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(userId).all();

    return NextResponse.json({ bots: results });
  } catch (error) {
    console.error("bots:get", error);
    return NextResponse.json({ error: "Database is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 80);
    const token = String(body.token || "").trim();
    const runtime = body.runtime === "node" ? "node" : "python";

    if (!name) return NextResponse.json({ error: "Bot name is required." }, { status: 400 });
    if (!token) return NextResponse.json({ error: "Discord bot token is required." }, { status: 400 });
    if (token.length > 300) return NextResponse.json({ error: "Invalid Discord bot token." }, { status: 400 });

    const discordResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bot ${token}`,
        "User-Agent": "BotVault/1.0"
      }
    });

    if (!discordResponse.ok) {
      return NextResponse.json(
        { error: discordResponse.status === 401 ? "That Discord bot token is invalid." : "Discord rejected the bot connection." },
        { status: 400 }
      );
    }

    const discordBot = (await discordResponse.json()) as DiscordBotUser;
    if (discordBot.bot === false) {
      return NextResponse.json({ error: "The Discord account is not a bot account." }, { status: 400 });
    }

    const env = await getCloudflareEnv();
    if (!env.BOT_TOKEN_ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: "Bot connection storage is not configured yet. Add the BOT_TOKEN_ENCRYPTION_KEY Cloudflare secret." },
        { status: 503 }
      );
    }

    const db = await getDb();
    const id = crypto.randomUUID();
    const encryptedToken = await encryptBotToken(token, env.BOT_TOKEN_ENCRYPTION_KEY);
    const displayName = discordBot.global_name || discordBot.username;

    await db.prepare(
      `INSERT INTO bots
       (id, user_id, name, runtime, status, connection_status, token_ciphertext,
        discord_bot_id, discord_username, discord_avatar)
       VALUES (?, ?, ?, ?, 'stopped', 'connected', ?, ?, ?, ?)`
    ).bind(
      id,
      userId,
      name,
      runtime,
      encryptedToken,
      discordBot.id,
      displayName,
      discordBot.avatar || null
    ).run();

    return NextResponse.json({
      bot: {
        id,
        name,
        runtime,
        status: "stopped",
        connectionStatus: "connected",
        discordBotId: discordBot.id,
        discordUsername: displayName,
        discordAvatar: discordBot.avatar || null
      }
    }, { status: 201 });
  } catch (error) {
    console.error("bots:create", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("BOT_TOKEN_ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "Bot connection storage is not configured yet. Add the BOT_TOKEN_ENCRYPTION_KEY Cloudflare secret." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not connect this Discord bot." }, { status: 500 });
  }
}
