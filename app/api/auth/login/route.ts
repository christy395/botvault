import { NextResponse } from "next/server";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const db = await getDb();
    const user = await db.prepare(
      "SELECT id, password_hash, email_verified FROM users WHERE email = ?"
    ).bind(email).first<{ id: string; password_hash: string; email_verified: number }>();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json({
        error: "Please verify your email before signing in.",
        verificationRequired: true,
      }, { status: 403 });
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", sessionCookie(session.id, session.expires));
    return response;
  } catch (error) {
    console.error("login", error);
    return NextResponse.json({ error: "Database is not configured yet. Create and bind the BotVault D1 database." }, { status: 503 });
  }
}
