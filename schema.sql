CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  token_ciphertext TEXT,
  discord_bot_id TEXT,
  discord_username TEXT,
  discord_avatar TEXT,
  node_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS servers (id TEXT PRIMARY KEY,name TEXT NOT NULL,endpoint TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'offline',cpu_percent REAL NOT NULL DEFAULT 0,ram_bytes INTEGER NOT NULL DEFAULT 0,storage_bytes INTEGER NOT NULL DEFAULT 0,last_heartbeat TEXT);
CREATE TABLE IF NOT EXISTS deployments (id TEXT PRIMARY KEY,bot_id TEXT NOT NULL,node_id TEXT,status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY (bot_id) REFERENCES bots(id));
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY,user_id TEXT,action TEXT NOT NULL,target_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_bot_id ON deployments(bot_id);