"use client";

import { upload } from "@vercel/blob/client";

import type { AssetView } from "@/lib/serialize";

export type UploadResult = { ok: true; asset: AssetView } | { ok: false; message: string };

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Browser → Blob storage directly; the server only mints the token and records
 * the result. Bytes never pass through a serverless function.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "That file is not an image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "That image is larger than 12MB." };
  }

  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/uploads",
      contentType: file.type,
    });

    const dimensions = await readDimensions(file);

    // Record it in the library. Idempotent on the URL, so the Blob webhook
    // firing as well on a real deployment cannot create a duplicate.
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: blob.url, ...dimensions }),
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

function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}
