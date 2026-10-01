function decodeKey(value: string): ArrayBuffer {
  const clean = value.trim();

  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    const buffer = new ArrayBuffer(32);
    const out = new Uint8Array(buffer);
    for (let i = 0; i < 32; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return buffer;
  }

  const binary = atob(clean);
  if (binary.length !== 32) {
    throw new Error("BOT_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
  }

  const buffer = new ArrayBuffer(32);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function toArrayBuffer(bytes: Uint8Array<ArrayBufferLike>): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    decodeKey(secret),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptBotToken(token: string, secret: string): Promise<string> {
  const key = await getKey(secret);

  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);

  const plaintext = toArrayBuffer(new TextEncoder().encode(token));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const packed = new Uint8Array(new ArrayBuffer(iv.length + encryptedBytes.length));
  packed.set(iv);
  packed.set(encryptedBytes, iv.length);

  return bytesToBase64(packed);
}

export async function decryptBotToken(ciphertext: string, secret: string): Promise<string> {
  const packed = base64ToBytes(ciphertext);

  if (packed.length < 12) {
    throw new Error("Invalid encrypted bot token.");
  }

  const ivBuffer = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuffer);
  iv.set(packed.subarray(0, 12));

  const encryptedBuffer = new ArrayBuffer(packed.length - 12);
  const encrypted = new Uint8Array(encryptedBuffer);
  encrypted.set(packed.subarray(12));

  const key = await getKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted.buffer,
  );

  return new TextDecoder().decode(plain);
}
