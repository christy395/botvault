import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";
import { sendVpsAction } from "@/lib/vps";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const db = await getDb();
    const bot = await db.prepare(
      `SELECT id FROM bots WHERE id = ? AND user_id = ? LIMIT 1`
    ).bind(id, userId).first<{ id: string }>();

    if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });

    await sendVpsAction({ action: "stop", botId: id });

    await db.prepare(
      `UPDATE bots
       SET status = 'stopped', connection_status = 'disconnected', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).bind(id, userId).run();

    return NextResponse.json({ ok: true, status: "stopped" });
  } catch (error) {
    console.error("bots:stop", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not stop the bot." },
      { status: 503 }
    );
  }
}
