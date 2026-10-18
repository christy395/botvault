import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/cloudflare";
import { sendVerificationEmail } from "@/lib/email";

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json(
        { error: "Use a valid email and a password with at least 8 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email).first();

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Try signing in or requesting a verification email." },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)"
    ).bind(userId, email, await hashPassword(password)).run();

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    await db.prepare(
      "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
    ).bind(userId, tokenHash, expiresAt).run();

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      await db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(userId).run();
      // Keep the account unverified so the user can configure email and request another link.
      console.error("verification email could not be sent:", error);
      return NextResponse.json({
        ok: true,
        verificationRequired: true,
        message: "Your account was created but the verification email could not be sent yet. Please try resending later.",
      });
    }

    return NextResponse.json({
      ok: true,
      verificationRequired: true,
      message: "Check your inbox for a verification link. It expires in 30 minutes.",
    });
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again later." },
      { status: 500 }
    );
  }
}
