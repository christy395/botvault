-- Add fields used by the New Bot Discord connection flow.
-- Safe to apply once to existing BotVault D1 databases.

ALTER TABLE bots ADD COLUMN connection_status TEXT NOT NULL DEFAULT 'disconnected';
ALTER TABLE bots ADD COLUMN discord_bot_id TEXT;
ALTER TABLE bots ADD COLUMN discord_username TEXT;
ALTER TABLE bots ADD COLUMN discord_avatar TEXT;
