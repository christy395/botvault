import { getCloudflareEnv } from "@/lib/cloudflare";

/** Verify a Turnstile token on the server. Fail closed when the secret is missing. */
export async function verifyTurnstile(token: unknown, request: Request): Promise<boolean> {
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return false;

  const env = await getCloudflareEnv();
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured.");
  }

  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });

  // Forward the client address for Turnstile risk analysis when Cloudflare supplies it.
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) form.set("remoteip", clientIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; hostname?: string };
  if (!result.success) return false;

  // If an expected hostname is configured, reject tokens issued for other sites.
  const expectedHostname = env.TURNSTILE_HOSTNAME;
  if (expectedHostname && result.hostname !== expectedHostname) return false;

  return true;
}
