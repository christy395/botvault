function decodeKey(value: string): Uint8Array {
  const clean = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const binary = atob(clean);
  if (binary.length !== 32) throw new Error("BOT_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", decodeKey(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBotToken(token: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  const bytes = new Uint8Array(encrypted);
  const packed = new Uint8Array(iv.length + bytes.length);
  packed.set(iv);
  packed.set(bytes, iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptBotToken(ciphertext: string, secret: string): Promise<string> {
  const packed = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const encrypted = packed.slice(12);
  const key = await getKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(plain);
}
