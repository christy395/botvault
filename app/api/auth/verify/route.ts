import { NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (token.length < 32 || token.length > 200) {
    return NextResponse.redirect(new URL("/login?verified=invalid", url.origin));
  }

  try {
    const db = await getDb();
    const tokenHash = await hashToken(token);
    const row = await db.prepare(
      "SELECT user_id, expires_at FROM email_verification_tokens WHERE token_hash = ?"
    ).bind(tokenHash).first<{ user_id: string; expires_at: string }>();

    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      if (row) await db.prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?").bind(tokenHash).run();
      return NextResponse.redirect(new URL("/login?verified=expired", url.origin));
    }

    await db.batch([
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(row.user_id),
      db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(row.user_id),
    ]);
    return NextResponse.redirect(new URL("/login?verified=success", url.origin));
  } catch (error) {
    console.error("email verification failed:", error);
    return NextResponse.redirect(new URL("/login?verified=error", url.origin));
  }
}
