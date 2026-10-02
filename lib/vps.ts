type VpsAction = "start" | "stop" | "restart";

type VpsRequest = {
  action: VpsAction;
  botId: string;
  token?: string;
  runtime?: "python" | "node";
  name?: string;
  discordBotId?: string;
};

function getVpsConfig() {
  const env = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;

  const url = env?.VPS_API_URL?.replace(/\/$/, "");
  const key = env?.VPS_API_KEY;

  if (!url || !key) {
    throw new Error("VPS runner is not configured. Add VPS_API_URL and VPS_API_KEY.");
  }

  return { url, key };
}

export async function sendVpsAction(payload: VpsRequest) {
  const { url, key } = getVpsConfig();

  const response = await fetch(`${url}/api/bots/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "BotVault-Worker/1.0"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: unknown }).error)
        : "The VPS runner rejected the request.";

    throw new Error(message);
  }

  return data;
}
