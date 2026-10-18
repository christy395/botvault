import { NextResponse } from "next/server";
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
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.prepare(
      "SELECT id, email_verified FROM users WHERE email = ?"
    ).bind(email).first<{ id: string; email_verified: number }>();

    // Keep the response generic so this endpoint does not disclose registered accounts.
    if (!user || user.email_verified) {
      return NextResponse.json({ ok: true, message: "If the account needs verification, an email will be sent." });
    }

    const now = new Date().toISOString();
    const recent = await db.prepare(
      "SELECT created_at FROM email_verification_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id).first<{ created_at: string }>();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      return NextResponse.json({ error: "Please wait a minute before requesting another email." }, { status: 429 });
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    await db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(user.id).run();
    await db.prepare(
      "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
    ).bind(user.id, tokenHash, expiresAt, now).run();

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      await db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(user.id).run();
      throw error;
    }

    return NextResponse.json({ ok: true, message: "Verification email sent if the account needs verification." });
  } catch (error) {
    console.error("resend verification error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send verification email." }, { status: 503 });
  }
}
