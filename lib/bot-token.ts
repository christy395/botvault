const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function deriveKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function getEncryptionSecret() {
  const secret = process.env.BOT_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("BOT_TOKEN_ENCRYPTION_KEY is not configured.");
  }
  return secret;
}

export async function encryptBotToken(token: string) {
  const key = await deriveKey(getEncryptionSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(token)
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptBotToken(payload: string) {
  const [ivText, ciphertextText] = payload.split(".");
  if (!ivText || !ciphertextText) throw new Error("Invalid encrypted token.");

  const key = await deriveKey(getEncryptionSecret());
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivText) },
    key,
    fromBase64(ciphertextText)
  );

  return decoder.decode(plaintext);
}
