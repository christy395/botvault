import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB?: D1Database }).DB;
  if (!db) throw new Error("BotVault D1 database is not configured. Add a D1 binding named DB in Cloudflare.");
  return db;
}
