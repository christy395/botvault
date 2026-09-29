import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = await getDb();
    const { results } = await db.prepare(
      "SELECT id, name, runtime, status, created_at, updated_at FROM bots WHERE user_id = ? ORDER BY created_at DESC"
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
    const runtime = body.runtime === "node" ? "node" : "python";
    if (!name) return NextResponse.json({ error: "Bot name is required." }, { status: 400 });

    const db = await getDb();
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO bots (id, user_id, name, runtime, status) VALUES (?, ?, ?, ?, 'stopped')"
    ).bind(id, userId, name, runtime).run();
    return NextResponse.json({ bot: { id, name, runtime, status: "stopped" } }, { status: 201 });
  } catch (error) {
    console.error("bots:create", error);
    return NextResponse.json({ error: "Database is not configured yet." }, { status: 503 });
  }
}
