import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const db = await getDb();
    const bot = await db.prepare(
      `SELECT id, name, runtime, status, connection_status, discord_bot_id, discord_username,
              discord_avatar, created_at, updated_at
       FROM bots WHERE id = ? AND user_id = ? LIMIT 1`
    ).bind(id, userId).first();

    if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
    return NextResponse.json({ bot });
  } catch (error) {
    console.error("bots:profile", error);
    return NextResponse.json({ error: "Could not load this bot." }, { status: 500 });
  }
}
