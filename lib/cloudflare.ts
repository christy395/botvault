import { env as workerEnv } from "cloudflare:workers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type BotVaultEnv = {
  DB?: D1Database;
  BOT_TOKEN_ENCRYPTION_KEY?: string;
};

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        runtime TEXT NOT NULL DEFAULT 'python',
        status TEXT NOT NULL DEFAULT 'stopped',
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        token_ciphertext TEXT,
        discord_bot_id TEXT,
        discord_username TEXT,
        discord_avatar TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id)")
  ]);

  for (const statement of [
    "ALTER TABLE bots ADD COLUMN connection_status TEXT NOT NULL DEFAULT 'disconnected'",
    "ALTER TABLE bots ADD COLUMN discord_bot_id TEXT",
    "ALTER TABLE bots ADD COLUMN discord_username TEXT",
    "ALTER TABLE bots ADD COLUMN discord_avatar TEXT",
    "ALTER TABLE bots ADD COLUMN token_ciphertext TEXT"
  ]) {
    try {
      await db.prepare(statement).run();
    } catch {
      // Column already exists.
    }
  }
}

export async function getCloudflareEnv(): Promise<BotVaultEnv> {
  const { env: contextEnv } = await getCloudflareContext({ async: true });
  const context = contextEnv as unknown as BotVaultEnv;
  const runtime = workerEnv as unknown as BotVaultEnv;

  const processEnv = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;

  return {
    DB: runtime.DB || context.DB,
    BOT_TOKEN_ENCRYPTION_KEY:
      runtime.BOT_TOKEN_ENCRYPTION_KEY ||
      context.BOT_TOKEN_ENCRYPTION_KEY ||
      processEnv?.BOT_TOKEN_ENCRYPTION_KEY
  };
}

export async function getDb() {
  const env = await getCloudflareEnv();
  const db = env.DB;

  if (!db) {
    throw new Error(
      "BotVault D1 database is not configured. Add a D1 binding named DB in Cloudflare."
    );
  }

  await ensureSchema(db);
  return db;
}
