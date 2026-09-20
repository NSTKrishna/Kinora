"use client";

import type { AssetView } from "@/lib/serialize";

export type UploadResult = { ok: true; asset: AssetView } | { ok: false; message: string };

const MAX_BYTES = 12 * 1024 * 1024;

type Signature = {
  endpoint: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  signature: string;
};

/**
 * Browser → Cloudinary directly; the server only signs the request and records
 * the result. Three steps:
 *
 *   1. ask our API for a signature scoped to this user
 *   2. post the file to Cloudinary with it
 *   3. tell our API the URL, which it re-checks against the signed path
 *
 * The bytes never pass through a serverless function, so the upload is not
 * bound by Vercel's ~4.5MB request body limit.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "That file is not an image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "That image is larger than 12MB." };
  }

  try {
    const signResponse = await fetch("/api/uploads", { method: "POST" });
    const signData = await signResponse.json();
    if (!signResponse.ok) {
      return {
        ok: false,
        message: signData?.error?.message ?? "Uploads are not available right now.",
      };
    }

    const signature = signData as Signature;

    const form = new FormData();
    form.set("file", file);
    form.set("api_key", signature.apiKey);
    form.set("timestamp", String(signature.timestamp));
    form.set("public_id", signature.publicId);
    form.set("signature", signature.signature);

    const upload = await fetch(signature.endpoint, { method: "POST", body: form });
    const uploaded = await upload.json();
    if (!upload.ok || !uploaded?.secure_url) {
      return { ok: false, message: uploaded?.error?.message ?? "Cloudinary rejected that file." };
    }

    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: uploaded.secure_url as string,
        width: uploaded.width,
        height: uploaded.height,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, message: data?.error?.message ?? "Could not save that upload." };
    }
    return { ok: true, asset: data.asset as AssetView };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return { ok: false, message };
  }
}
