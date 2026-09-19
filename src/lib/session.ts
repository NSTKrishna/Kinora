/**
 * Guest sessions.
 *
 * The cookie carries a user id signed with HMAC-SHA256 so it can be trusted
 * without a database read — and so a visitor cannot hand us someone else's id.
 * Web Crypto only: this runs in edge middleware as well as the node runtime.
 */

export const SESSION_COOKIE = "kinora_sid";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // one year

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set");
  }
  // Dev-only fallback so `pnpm dev` works straight after clone.
  return "kinora-dev-only-insecure-secret";
}

function base64url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

/** `<uuid>.<signature>` */
export async function createSessionToken(userId: string): Promise<string> {
  return `${userId}.${await sign(userId)}`;
}

/** Returns the user id, or null if the cookie is missing, malformed or forged. */
export async function readSessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!isUuid(userId)) return null;

  const expected = await sign(userId);
  return timingSafeEqual(signature, expected) ? userId : null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
} as const;
