import "server-only";

/**
 * fal webhook verification.
 *
 * Docs checked 2026-09-20: every delivery is signed with ED25519. The signed
 * message is four newline-separated parts — request id, user id, timestamp and
 * the hex SHA-256 of the raw body — and the public keys come from fal's JWKS.
 */

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const JWKS_TTL_MS = 60 * 60 * 1000; // an hour; docs say never cache beyond a day
const MAX_SKEW_SECONDS = 5 * 60;

type Jwk = { x: string };

let cache: { keys: Jwk[]; fetchedAt: number } | undefined;

async function getKeys(): Promise<Jwk[]> {
  if (cache && Date.now() - cache.fetchedAt < JWKS_TTL_MS) return cache.keys;

  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);

  const body = (await response.json()) as { keys?: Jwk[] };
  cache = { keys: body.keys ?? [], fetchedAt: Date.now() };
  return cache.keys;
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type WebhookVerification = { ok: true } | { ok: false; reason: string };

export async function verifyFalWebhook(
  headers: Headers,
  rawBody: string,
): Promise<WebhookVerification> {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signature = headers.get("x-fal-webhook-signature");

  if (!requestId || !userId || !timestamp || !signature) {
    return { ok: false, reason: "missing signature headers" };
  }

  // A valid old signature replayed later is still a replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp outside the allowed window" };
  }

  const bodyHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)));
  const message = new TextEncoder().encode([requestId, userId, timestamp, bodyHash].join("\n"));

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = fromHex(signature);
  } catch {
    return { ok: false, reason: "signature is not hex" };
  }

  for (const jwk of await getKeys()) {
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        fromBase64Url(jwk.x),
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, signatureBytes, message);
      if (valid) return { ok: true };
    } catch {
      // Try the next key — a rotated JWKS can contain keys we cannot import.
    }
  }

  return { ok: false, reason: "no key verified this signature" };
}
