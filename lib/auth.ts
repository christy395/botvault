import { getDb } from "./cloudflare";

const SESSION_DAYS = 30;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$120000$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function createSession(userId: string) {
  const db = await getDb();
  const id = randomId();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expires).run();
  return { id, expires };
}

export async function getSessionUserId(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )botvault_session=([^;]+)/);
  if (!match) return null;
  const sessionId = decodeURIComponent(match[1]);
  const db = await getDb();
  const row = await db.prepare(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?"
  ).bind(sessionId).first<{ user_id: string; expires_at: string }>();
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row.user_id;
}

export function sessionCookie(id: string, expires: string) {
  return `botvault_session=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expires).toUTCString()}`;
}

export function clearSessionCookie() {
  return "botvault_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
