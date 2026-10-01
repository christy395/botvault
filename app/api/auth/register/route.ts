import { NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    // Validate normal email addresses and require a secure minimum password length.
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json(
        { error: "Use a valid email and a password with at least 8 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
      .bind(userId, email, await hashPassword(password))
      .run();

    const session = await createSession(userId);
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", sessionCookie(session.id, session.expires));
    return response;
  } catch (error) {
    console.error("register", error);
    return NextResponse.json(
      { error: "Database is not configured yet. Create and bind the BotVault D1 database." },
      { status: 503 }
    );
  }
}
