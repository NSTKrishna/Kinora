import "server-only";

import { createHash, randomUUID } from "node:crypto";

/**
 * Cloudinary — where every image Kinora holds actually lives.
 *
 * Two jobs, one account:
 *   uploads  the photo someone drops on an Effect, browser → Cloudinary direct
 *   renders  the WebP Cloudflare Workers AI hands back, server → Cloudinary
 *
 * Direct-from-browser matters more than it looks: a Vercel serverless function
 * caps its request body at about 4.5MB on the Hobby plan, so a 12MB phone
 * photo posted through our own API would fail on the deployment while working
 * locally. The bytes never touch us.
 *
 * Hand-rolled rather than pulling in the SDK, for the same reason the
 * Cloudflare adapter hand-rolls its fetch: the signing rule is six lines and
 * the SDK is a large dependency for one endpoint.
 *
 * Docs checked 2026-09-20: signed uploads sign the alphabetically sorted
 * params (excluding file, api_key, resource_type and cloud_name), append the
 * API secret, and SHA-1 the result.
 */

const API_BASE = "https://api.cloudinary.com/v1_1";
const UPLOAD_TIMEOUT_MS = 30_000;

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function credentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are not all set.",
    );
  }
  return { cloudName, apiKey, apiSecret };
}

/**
 * Where a file belongs, and who it belongs to.
 *
 * The owner's id is in the path on purpose: it is what lets the record step
 * prove a returned URL is the caller's own upload rather than a URL they
 * guessed, pasted or lifted from someone else's library.
 */
export function uploadPublicId(userId: string): string {
  return `kinora/uploads/${userId}/${randomUUID()}`;
}

export function renderPublicId(userId: string): string {
  return `kinora/renders/${userId}/${randomUUID()}`;
}

/** Cloudinary's signature: sorted `k=v&k=v`, then the secret, then SHA-1. */
export function sign(params: Record<string, string | number>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(canonical + apiSecret)
    .digest("hex");
}

/** Everything the browser needs to post one file straight to Cloudinary. */
export function signedUpload(userId: string) {
  const { cloudName, apiKey, apiSecret } = credentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = uploadPublicId(userId);

  return {
    endpoint: `${API_BASE}/${cloudName}/image/upload`,
    cloudName,
    apiKey,
    timestamp,
    publicId,
    signature: sign({ public_id: publicId, timestamp }, apiSecret),
  };
}

type UploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  error?: { message?: string };
};

/**
 * Server-side upload, for bytes we already hold — the WebP that came back from
 * Cloudflare Workers AI. Sent as a data URI, which Cloudinary accepts and which
 * avoids assembling multipart by hand.
 */
export async function uploadBytes(
  bytes: Buffer,
  options: { publicId: string; contentType: string },
): Promise<{ url: string; publicId: string; width?: number; height?: number }> {
  const { cloudName, apiKey, apiSecret } = credentials();
  const timestamp = Math.floor(Date.now() / 1000);

  const form = new FormData();
  form.set("file", `data:${options.contentType};base64,${bytes.toString("base64")}`);
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("public_id", options.publicId);
  form.set("signature", sign({ public_id: options.publicId, timestamp }, apiSecret));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let body: UploadResponse;
  try {
    const response = await fetch(`${API_BASE}/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    body = (await response.json()) as UploadResponse;
    if (!response.ok || !body.secure_url) {
      throw new Error(body.error?.message ?? `Cloudinary returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }

  return {
    url: body.secure_url!,
    publicId: body.public_id ?? options.publicId,
    width: body.width,
    height: body.height,
  };
}

/**
 * Is this URL one of ours, uploaded by this user?
 *
 * The record endpoint must not become a way to attach an arbitrary remote
 * image to an account, so both the cloud and the owner segment have to match.
 */
export function isOwnUploadUrl(url: string, userId: string): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "res.cloudinary.com" &&
    parsed.pathname.startsWith(`/${cloudName}/`) &&
    // Cloudinary puts transformations and a version between "upload" and the
    // public id, so match the owner segment anywhere in the path rather than
    // pinning an exact prefix.
    parsed.pathname.includes(`/kinora/uploads/${userId}/`)
  );
}
