import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dbGet, dbRun, nowIso } from "@/lib/db";

const PREFIX = "v1";

function keyFromEnv(): Buffer | null {
  const raw =
    process.env.CONNECTOR_ENCRYPTION_KEY ||
    process.env.HIREVOICE_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) return null;

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;

  const hex = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : null;
  if (hex) return hex;

  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Falls back to a device-local secret so connector tokens still work in a
 * fresh checkout. Production should set CONNECTOR_ENCRYPTION_KEY.
 */
function localSecret(): Buffer {
  const existing = dbGet<{ value: string }>("SELECT value FROM meta WHERE key = 'local_secret'");
  if (existing) return Buffer.from(existing.value, "base64");

  const dir = process.env.HIREVOICE_DATA_DIR || path.join(process.cwd(), ".data");
  const file = path.join(dir, "local-secret.key");
  try {
    if (fs.existsSync(file)) {
      const value = fs.readFileSync(file);
      if (value.length === 32) return value;
    }
  } catch {
    /* fall through to a fresh secret */
  }

  const secret = crypto.randomBytes(32);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  } catch {
    dbRun(
      "INSERT INTO meta (key, value, updated_at) VALUES ('local_secret', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      secret.toString("base64"),
      nowIso(),
    );
  }
  return secret;
}

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = keyFromEnv() ?? localSecret();
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decrypt(payload: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== PREFIX || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
