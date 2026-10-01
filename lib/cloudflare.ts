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

  // Upgrade an existing BotVault D1 database without deleting current bot records.
  for (const statement of [
    "ALTER TABLE bots ADD COLUMN connection_status TEXT NOT NULL DEFAULT 'disconnected'",
    "ALTER TABLE bots ADD COLUMN discord_bot_id TEXT",
    "ALTER TABLE bots ADD COLUMN discord_username TEXT",
    "ALTER TABLE bots ADD COLUMN discord_avatar TEXT"
  ]) {
    try {
      await db.prepare(statement).run();
    } catch {
      // Column already exists on upgraded databases.
    }
  }
}

export async function getCloudflareEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as BotVaultEnv;
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
