import { NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie } from "@/lib/auth";
import { getCloudflareEnv, getDb } from "@/lib/cloudflare";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const env = await getCloudflareEnv();
    if (!env.TURNSTILE_SECRET_KEY) {
      return NextResponse.json({ error: "Security verification is not configured. Please contact the site owner." }, { status: 503 });
    }
    if (!(await verifyTurnstile(body.challengeToken, request))) {
      return NextResponse.json({ error: "Security verification failed. Please try again." }, { status: 403 });
    }

    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json(
        { error: "Use a valid email and a password with at least 8 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();

    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
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
    console.error("register error:", error);
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Registration failed",
        details: message
      },
      { status: 500 }
    );
  }
}
