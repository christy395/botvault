import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";
import { getVpsBotLogs } from "@/lib/vps";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const db = await getDb();
    const bot = await db.prepare(
      "SELECT id FROM bots WHERE id = ? AND user_id = ? LIMIT 1"
    ).bind(id, userId).first<{ id: string }>();

    if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });

    const logs = await getVpsBotLogs(id, 100);
    return NextResponse.json({ logs }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hosting runner logs are unavailable.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
