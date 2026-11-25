import { createReadStream, createWriteStream } from "node:fs";
import { open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import type { LookupAddress, LookupOptions } from "node:dns";
import { createHash, randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage } from "node:http";
import { detectVideoType, MediaInputError, validateSourceUrl } from "./source-validation";

type PinnedLookup = (
  hostname: string,
  options: LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
) => void;

type DownloadOptions = {
  sourceUrl: string;
  destination: string;
  resumeMetadataPath: string;
  maxBytes: number;
  timeoutMs: number;
  allowedHosts: ReadonlySet<string>;
  signal: AbortSignal;
  onProgress: (bytes: number, total: number | null) => Promise<void>;
};

type ResumeMetadata = {
  sourceHash: string;
  resourceHash: string;
  validator: string;
  mimeType: string | null;
};

async function readResumeMetadata(path: string): Promise<ResumeMetadata | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      "sourceHash" in parsed &&
      "resourceHash" in parsed &&
      "validator" in parsed &&
      typeof parsed.sourceHash === "string" &&
      typeof parsed.resourceHash === "string" &&
      typeof parsed.validator === "string" &&
      ("mimeType" in parsed) &&
      (typeof parsed.mimeType === "string" || parsed.mimeType === null)
    ) {
      return parsed as ResumeMetadata;
    }
  } catch {
    return null;
  }
  return null;
}

async function writeResumeMetadata(
  path: string,
  metadata: ResumeMetadata,
): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(metadata), { mode: 0o600 });
  await rename(temporary, path);
}

function pinnedLookup(address: string): PinnedLookup {
  return (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, [{ address, family: 4 }]);
      return;
    }
    callback(null, address, 4);
  };
}

function openHttpsResponse(
  url: URL,
  address: string,
  headers: Record<string, string>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers,
        signal,
        lookup: pinnedLookup(address),
        servername: url.hostname,
        maxHeaderSize: 16 * 1024,
      },
      resolve,
    );
    request.setTimeout(timeoutMs, () =>
      request.destroy(new Error("Media source request timed out.")),
    );
    request.once("error", reject);
    request.end();
  });
}

async function detectFromFile(
  path: string,
  contentType: string | null,
): Promise<{ mimeType: string; sourceType: "MP4" | "OTHER" }> {
  const file = await open(path, "r");
  try {
    const bytes = Buffer.alloc(32);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    return detectVideoType(bytes.subarray(0, bytesRead), contentType);
  } finally {
    await file.close();
  }
}

export async function downloadAuthorizedVideo(
  options: DownloadOptions,
): Promise<{
  fileSize: number;
  mimeType: string;
  sourceType: "MP4" | "OTHER";
}> {
  let currentUrl = options.sourceUrl;
  let redirects = 0;
  const sourceHash = createHash("sha256").update(options.sourceUrl).digest("hex");
  let resumeMetadata = await readResumeMetadata(options.resumeMetadataPath);
  let totalBytes = (await stat(options.destination).catch(() => null))?.size ?? 0;
  let finalContentType: string | null = null;
  if (totalBytes > options.maxBytes) {
    throw new MediaInputError("The partial download exceeds the configured size limit.");
  }

  while (true) {
    const validated = await validateSourceUrl(
      currentUrl,
      options.allowedHosts,
    );
    const resourceHash = createHash("sha256")
      .update(validated.url.toString())
      .digest("hex");
    const matchingMetadata =
      resumeMetadata?.sourceHash === sourceHash &&
      resumeMetadata.resourceHash === resourceHash
        ? resumeMetadata
        : null;
    const canResume = totalBytes > 0 && matchingMetadata !== null;
    const response = await openHttpsResponse(
      validated.url,
      validated.addresses[0],
      {
        "User-Agent": "ANIMEX-authorized-media-import/1.0",
        Accept: "video/mp4, video/webm, video/quicktime, application/octet-stream",
        ...(canResume
          ? {
              Range: `bytes=${totalBytes}-`,
              "If-Range": matchingMetadata?.validator ?? "",
            }
          : {}),
      },
      options.timeoutMs,
      options.signal,
    );
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
      const location = response.headers.location;
      response.destroy();
      if (!location || redirects >= 3) {
        throw new MediaInputError("The media source exceeded the redirect limit.");
      }
      currentUrl = new URL(location, validated.url).toString();
      redirects += 1;
      continue;
    }

    const rangeHeader = response.headers["content-range"];
    if (response.statusCode === 416 && totalBytes > 0) {
      response.destroy();
      const completedRange = /^bytes \*\/(\d+)$/.exec(rangeHeader ?? "");
      if (canResume && completedRange && Number(completedRange[1]) === totalBytes) {
        finalContentType =
          matchingMetadata?.mimeType ?? pathContentType(currentUrl);
        break;
      }
      throw new MediaInputError("The source rejected the resume range.");
    }

    if (response.statusCode !== 200 && response.statusCode !== 206) {
      response.destroy();
      throw new MediaInputError(
        `The authorized source returned HTTP ${response.statusCode ?? "unknown"}.`,
      );
    }
    finalContentType = response.headers["content-type"] ?? null;

    if (response.statusCode === 206) {
      const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(rangeHeader ?? "");
      const start = match ? Number(match[1]) : -1;
      const end = match ? Number(match[2]) : -1;
      const total = match?.[3] && match[3] !== "*" ? Number(match[3]) : null;
      if (
        !canResume ||
        !match ||
        start !== totalBytes ||
        end < start ||
        (total !== null && end >= total)
      ) {
        response.destroy();
        throw new MediaInputError("The source returned an invalid resume range.");
      }
    } else if (totalBytes > 0) {
      totalBytes = 0;
    }

    const acceptsRanges =
      response.statusCode === 206 ||
      (response.headers["accept-ranges"] ?? "")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim())
      .includes("bytes");
    const validator = response.headers.etag ?? response.headers["last-modified"];
    if (acceptsRanges && validator) {
      resumeMetadata = {
        sourceHash,
        resourceHash,
        validator,
        mimeType: finalContentType,
      };
      await writeResumeMetadata(options.resumeMetadataPath, resumeMetadata);
    } else {
      resumeMetadata = null;
      await rm(options.resumeMetadataPath, { force: true });
    }

    const contentLengthHeader = response.headers["content-length"];
    const contentLength = contentLengthHeader
      ? Number(contentLengthHeader)
      : null;
    if (
      contentLength !== null &&
      (!Number.isSafeInteger(contentLength) ||
        contentLength < 0 ||
        totalBytes + contentLength > options.maxBytes)
    ) {
      response.destroy();
      throw new MediaInputError("The video exceeds the configured size limit.");
    }

    let expectedTotal: number | null = null;
    if (response.statusCode === 206) {
      const match = /^bytes \d+-\d+\/(\d+)$/.exec(rangeHeader ?? "");
      expectedTotal = match ? Number(match[1]) : null;
    } else if (contentLength !== null) {
      expectedTotal = contentLength;
    }
    if (expectedTotal !== null && expectedTotal > options.maxBytes) {
      response.destroy();
      throw new MediaInputError("The video exceeds the configured size limit.");
    }

    let lastProgressAt = Date.now();
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalBytes += chunk.length;
        if (totalBytes > options.maxBytes) {
          callback(new MediaInputError("The video exceeds the configured size limit."));
          return;
        }
        if (Date.now() - lastProgressAt >= 1000) {
          lastProgressAt = Date.now();
          void options.onProgress(totalBytes, expectedTotal).then(
            () => callback(null, chunk),
            callback,
          );
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(
      response,
      counter,
      createWriteStream(options.destination, {
        flags: totalBytes > 0 ? "a" : "w",
        mode: 0o600,
      }),
      { signal: options.signal },
    );
    await options.onProgress(totalBytes, expectedTotal);

    if (expectedTotal === null || totalBytes >= expectedTotal) break;
  }

  const fileInfo = await stat(options.destination);
  if (fileInfo.size < 12 || fileInfo.size > options.maxBytes) {
    throw new MediaInputError("The downloaded file is empty or exceeds the size limit.");
  }

  const contentType = finalContentType ?? pathContentType(currentUrl);
  const detected = await detectFromFile(options.destination, contentType);
  await rm(options.resumeMetadataPath, { force: true });
  return {
    fileSize: fileInfo.size,
    mimeType: detected.mimeType,
    sourceType: detected.sourceType,
  };
}

function pathContentType(sourceUrl: string): string | null {
  const path = new URL(sourceUrl).pathname.toLowerCase();
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "video/mp4";
  return null;
}

export async function uploadFileStream(
  url: URL,
  path: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  onProgress: (bytes: number, total: number) => Promise<void>,
  multipart?: { prefix: string; suffix: string },
): Promise<unknown> {
  const fileSize = (await stat(path)).size;
  const prefixBytes = Buffer.byteLength(multipart?.prefix ?? "");
  const suffixBytes = Buffer.byteLength(multipart?.suffix ?? "");
  const contentLength = fileSize + prefixBytes + suffixBytes;
  const requestHeaders: Record<string, string> = {
    ...headers,
    "Content-Length": String(contentLength),
  };

  const responsePromise = new Promise<IncomingMessage>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: multipart ? "POST" : "PUT",
        headers: requestHeaders,
        signal,
        maxHeaderSize: 16 * 1024,
      },
      resolve,
    );
    request.setTimeout(20 * 60 * 1000, () =>
      request.destroy(new Error("Video provider upload timed out.")),
    );
    request.once("error", reject);
    if (multipart?.prefix) request.write(multipart.prefix);

    let sent = prefixBytes;
    let lastProgressAt = Date.now();
    let progress = Promise.resolve();
    const file = createReadStream(path);
    file.on("data", (chunk: string | Buffer) => {
      sent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      if (Date.now() - lastProgressAt >= 1000 || sent >= contentLength) {
        lastProgressAt = Date.now();
        const currentSent = sent;
        progress = progress.then(() => onProgress(currentSent, contentLength));
      }
    });
    file.once("error", (error) => request.destroy(error));
    file.once("end", () => {
      void progress.then(() => {
        if (multipart?.suffix) request.write(multipart.suffix);
        request.end();
      }, (error: Error) => request.destroy(error));
    });
    file.pipe(request, { end: false });
  });

  const response = await responsePromise;
  const chunks: Buffer[] = [];
  let responseBytes = 0;
  for await (const chunk of response) {
    responseBytes += Buffer.byteLength(chunk);
    if (responseBytes > 1024 * 1024) {
      response.destroy(new Error("Video provider returned an oversized response."));
      throw new Error("Video provider returned an oversized response.");
    }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  let parsed: unknown = null;
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body.slice(0, 1000);
    }
  }
  if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
    throw new Error(`Video provider upload failed with HTTP ${response.statusCode}.`);
  }
  await onProgress(contentLength, contentLength);
  return parsed;
}

export async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Provider returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok || !value || typeof value !== "object") {
    throw new Error(`Provider request failed with HTTP ${response.status}.`);
  }
  return value as Record<string, unknown>;
}
