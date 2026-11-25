import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import type { VideoProvider } from "@prisma/client";
import { readJsonResponse, uploadFileStream } from "./network";

type ProviderConfiguration = {
  configured: boolean;
  missing: string[];
};

export type UploadedAsset = {
  providerName: string;
  providerAssetId: string;
  playbackReference: string;
  durationSeconds: number | null;
};

export function getProviderConfigurations(): Record<
  VideoProvider,
  ProviderConfiguration
> {
  const config = (
    values: Array<[string, string | undefined]>
  ): ProviderConfiguration => {
    const missing = values
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);
    return { configured: missing.length === 0, missing };
  };

  return {
    CLOUDFLARE_STREAM: config([
      ["CLOUDFLARE_ACCOUNT_ID", process.env.CLOUDFLARE_ACCOUNT_ID],
      ["CLOUDFLARE_STREAM_API_TOKEN", process.env.CLOUDFLARE_STREAM_API_TOKEN],
    ]),
    BUNNY_STREAM: config([
      ["BUNNY_STREAM_LIBRARY_ID", process.env.BUNNY_STREAM_LIBRARY_ID],
      ["BUNNY_STREAM_API_KEY", process.env.BUNNY_STREAM_API_KEY],
    ]),
    MUX: config([
      ["MUX_TOKEN_ID", process.env.MUX_TOKEN_ID],
      ["MUX_TOKEN_SECRET", process.env.MUX_TOKEN_SECRET],
    ]),
  };
}

function requireProviderConfig(provider: VideoProvider) {
  const config = getProviderConfigurations()[provider];
  if (!config.configured) {
    throw new Error(
      `${providerLabel(provider)} is not configured. Missing server environment variables: ${config.missing.join(", ")}.`,
    );
  }
}

export function providerLabel(provider: VideoProvider): string {
  return {
    CLOUDFLARE_STREAM: "Cloudflare Stream",
    BUNNY_STREAM: "Bunny Stream",
    MUX: "Mux",
  }[provider];
}

export async function uploadMediaAsset(
  provider: VideoProvider,
  filePath: string,
  title: string,
  mimeType: string,
  signal: AbortSignal,
  onProgress: (sent: number, total: number) => Promise<void>,
  onAssetCreated: (assetId: string) => Promise<void>,
): Promise<UploadedAsset> {
  requireProviderConfig(provider);
  if (provider === "CLOUDFLARE_STREAM") {
    return uploadToCloudflare(filePath, title, mimeType, signal, onProgress, onAssetCreated);
  }
  if (provider === "BUNNY_STREAM") {
    return uploadToBunny(filePath, title, mimeType, signal, onProgress, onAssetCreated);
  }
  return uploadToMux(filePath, mimeType, signal, onProgress, onAssetCreated);
}

async function uploadToCloudflare(
  filePath: string,
  title: string,
  mimeType: string,
  signal: AbortSignal,
  onProgress: (sent: number, total: number) => Promise<void>,
  onAssetCreated: (assetId: string) => Promise<void>,
): Promise<UploadedAsset> {
  const fileSize = (await stat(filePath)).size;
  if (fileSize >= 200 * 1024 * 1024) {
    throw new Error(
      "Cloudflare Stream basic upload supports files smaller than 200 MB. Select a smaller file or use another configured provider.",
    );
  }

  const boundary = `animex-${randomUUID()}`;
  const safeTitle = title.replace(/[\r\n"]/g, " ").slice(0, 180);
  const extension =
    mimeType === "video/webm" ? "webm" : mimeType === "video/quicktime" ? "mov" : "mp4";
  const prefix =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="requireSignedURLs"\r\n\r\ntrue\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeTitle}.${extension}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--\r\n`;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  if (!accountId || !token) throw new Error("Cloudflare Stream credentials are missing.");

  const result = await uploadFileStream(
    new URL(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream`,
    ),
    filePath,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    signal,
    onProgress,
    { prefix, suffix },
  );
  if (!result || typeof result !== "object") {
    throw new Error("Cloudflare Stream returned an invalid upload response.");
  }
  const response = result as {
    success?: boolean;
    result?: { uid?: string; duration?: number };
  };
  const assetId = response.result?.uid;
  if (response.success !== true || !assetId) {
    throw new Error("Cloudflare Stream did not confirm the uploaded asset.");
  }
  await onAssetCreated(assetId);
  return {
    providerName: providerLabel("CLOUDFLARE_STREAM"),
    providerAssetId: assetId,
    playbackReference: `https://iframe.videodelivery.net/${assetId}`,
    durationSeconds: Number.isFinite(response.result?.duration)
      ? Math.round(response.result?.duration ?? 0)
      : null,
  };
}

async function uploadToBunny(
  filePath: string,
  title: string,
  mimeType: string,
  signal: AbortSignal,
  onProgress: (sent: number, total: number) => Promise<void>,
  onAssetCreated: (assetId: string) => Promise<void>,
): Promise<UploadedAsset> {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!libraryId || !apiKey || !/^\d+$/.test(libraryId)) {
    throw new Error("Bunny Stream credentials are missing or invalid.");
  }
  const baseUrl = `https://video.bunnycdn.com/library/${libraryId}`;
  const createResponse = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: title.slice(0, 180) }),
    signal,
  });
  const created = await readJsonResponse(createResponse);
  const guid =
    created.guid ??
    (created.data && typeof created.data === "object"
      ? (created.data as { guid?: unknown }).guid
      : undefined);
  if (typeof guid !== "string" || !guid) {
    throw new Error("Bunny Stream did not return a video identifier.");
  }
  await onAssetCreated(guid);

  await uploadFileStream(
    new URL(`${baseUrl}/videos/${encodeURIComponent(guid)}`),
    filePath,
    {
      AccessKey: apiKey,
      "Content-Type": mimeType,
    },
    signal,
    onProgress,
  );
  return {
    providerName: providerLabel("BUNNY_STREAM"),
    providerAssetId: guid,
    playbackReference: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}`,
    durationSeconds: null,
  };
}

async function uploadToMux(
  filePath: string,
  mimeType: string,
  signal: AbortSignal,
  onProgress: (sent: number, total: number) => Promise<void>,
  onAssetCreated: (assetId: string) => Promise<void>,
): Promise<UploadedAsset> {
  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
  if (!tokenId || !tokenSecret) throw new Error("Mux credentials are missing.");
  const authorization = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
  const origin = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000").origin;
  const createResponse = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_origin: origin,
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ["signed"],
        video_quality: "basic",
      },
    }),
    signal,
  });
  const created = await readJsonResponse(createResponse);
  const uploadData = created.data as
    | { id?: unknown; url?: unknown }
    | undefined;
  if (
    !uploadData ||
    typeof uploadData.id !== "string" ||
    typeof uploadData.url !== "string"
  ) {
    throw new Error("Mux did not return a direct upload URL.");
  }

  const uploadUrl = new URL(uploadData.url);
  if (
    uploadUrl.protocol !== "https:" ||
    uploadUrl.username ||
    uploadUrl.password ||
    (uploadUrl.port && uploadUrl.port !== "443") ||
    !(
      uploadUrl.hostname === "storage.googleapis.com" ||
      uploadUrl.hostname.endsWith(".mux.com")
    )
  ) {
    throw new Error("Mux returned an unexpected upload destination.");
  }
  await onAssetCreated(`upload:${uploadData.id}`);
  await uploadFileStream(
    uploadUrl,
    filePath,
    { "Content-Type": mimeType },
    signal,
    onProgress,
  );

  const uploadId = uploadData.id;
  let assetId: string | null = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const statusResponse = await fetch(
      `https://api.mux.com/video/v1/uploads/${encodeURIComponent(uploadId)}`,
      { headers: { Authorization: authorization }, signal },
    );
    const statusData = await readJsonResponse(statusResponse);
    const uploadStatus = statusData.data as
      | { asset_id?: unknown; status?: unknown }
      | undefined;
    if (typeof uploadStatus?.asset_id === "string") {
      assetId = uploadStatus.asset_id;
      await onAssetCreated(assetId);
      break;
    }
    if (uploadStatus?.status === "errored" || uploadStatus?.status === "timed_out") {
      throw new Error("Mux could not finish processing the uploaded video.");
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        reject(signal.reason ?? new Error("Upload was cancelled."));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, 5000);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  if (!assetId) {
    throw new Error("Mux has not created the asset yet. Retry after it finishes processing.");
  }

  const assetResponse = await fetch(
    `https://api.mux.com/video/v1/assets/${encodeURIComponent(assetId)}`,
    { headers: { Authorization: authorization }, signal },
  );
  const assetData = await readJsonResponse(assetResponse);
  const asset = assetData.data as
    | {
        playback_ids?: Array<{ id?: unknown }>;
        duration?: unknown;
      }
    | undefined;
  const playbackId = asset?.playback_ids?.find(
    (entry) => typeof entry.id === "string",
  )?.id;
  if (typeof playbackId !== "string") {
    throw new Error("Mux created the asset without a signed playback ID.");
  }
  return {
    providerName: providerLabel("MUX"),
    providerAssetId: assetId,
    playbackReference: `https://stream.mux.com/${playbackId}.m3u8`,
    durationSeconds: Number.isFinite(asset?.duration)
      ? Math.round(Number(asset?.duration))
      : null,
  };
}
