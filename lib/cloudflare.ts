import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type BotVaultEnv = { DB?: D1Database };

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as BotVaultEnv).DB;
  if (!db) throw new Error("BotVault D1 database is not configured. Add a D1 binding named DB in Cloudflare.");
  return db;
}
