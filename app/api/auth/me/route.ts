import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ authenticated: false }, { status: 401 });
    const db = await getDb();
    const user = await db.prepare("SELECT id, email, created_at FROM users WHERE id = ?")
      .bind(userId).first();
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ error: "Database is not configured yet." }, { status: 503 });
  }
}
