import { loadEnvConfig } from "@next/env";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MediaIngestionJob } from "@prisma/client";
import { Pool } from "pg";
import { decryptSourceUrl } from "../src/lib/media/source-crypto";
import { downloadAuthorizedVideo } from "../src/lib/media/network";
import { uploadMediaAsset } from "../src/lib/media/providers";
import { getAllowedSourceHosts, MediaInputError } from "../src/lib/media/source-validation";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the media worker.");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const workerIdPrefix = `${os.hostname()}:${process.pid}`;
const tempDirectory = path.resolve(
  process.env.MEDIA_DOWNLOAD_DIR ?? path.join(process.cwd(), "temp", "media-ingestion"),
);
const maxBytes = Number(process.env.MEDIA_MAX_FILE_BYTES ?? 1_073_741_824);
const timeoutMs = Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS ?? 1_200_000);
const leaseDurationMs = 60_000;
let shuttingDown = false;
const controllers = new Set<AbortController>();
const cleanedCancelledJobs = new Set<string>();
let lastCancelledCleanup = 0;

if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 * 1024 || maxBytes > 2_147_483_647) {
  throw new Error("MEDIA_MAX_FILE_BYTES must be between 1 MiB and 2 GiB.");
}
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 7_200_000) {
  throw new Error("MEDIA_DOWNLOAD_TIMEOUT_MS must be between 10 seconds and 2 hours.");
}
if (!/^[a-fA-F0-9]{64}$/.test(process.env.MEDIA_JOB_ENCRYPTION_KEY ?? "")) {
  throw new Error("Set MEDIA_JOB_ENCRYPTION_KEY to a generated 32-byte hexadecimal key.");
}

function getConcurrency(): number {
  const parsed = Number(process.env.MEDIA_WORKER_CONCURRENCY ?? "1");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new Error("MEDIA_WORKER_CONCURRENCY must be an integer from 1 to 3.");
  }
  return parsed;
}

function getMaxBytes(): number {
  return maxBytes;
}

function getTempPath(jobId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    throw new Error("Invalid media job identifier.");
  }
  return path.join(tempDirectory, `${jobId}.part`);
}

async function cleanupCancelledDownloads(): Promise<void> {
  if (Date.now() - lastCancelledCleanup < 15_000) return;
  lastCancelledCleanup = Date.now();
  const jobs = await prisma.mediaIngestionJob.findMany({
    where: { status: "CANCELLED", workerId: null },
    take: 1000,
    select: { id: true },
  });
  for (const job of jobs) {
    if (cleanedCancelledJobs.has(job.id)) continue;
    const filePath = getTempPath(job.id);
    await rm(filePath, { force: true });
    await rm(`${filePath}.resume.json`, { force: true });
    cleanedCancelledJobs.add(job.id);
  }
}

async function claimJob(workerId: string): Promise<MediaIngestionJob | null> {
  const candidate = await prisma.mediaIngestionJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;

  const claimed = await prisma.mediaIngestionJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "DOWNLOADING",
      workerId,
      leaseExpiresAt: new Date(Date.now() + leaseDurationMs),
      attempts: { increment: 1 },
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) return null;
  return prisma.mediaIngestionJob.findUnique({
    where: { id: candidate.id },
  });
}

async function recoverExpiredJobs(): Promise<void> {
  const now = new Date();
  await prisma.mediaIngestionJob.updateMany({
    where: {
      status: "DOWNLOADING",
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: "QUEUED",
      workerId: null,
      leaseExpiresAt: null,
      errorMessage: "Worker restarted. Resuming the saved partial download.",
    },
  });
  await prisma.mediaIngestionJob.updateMany({
    where: {
      status: "UPLOADING",
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: "FAILED",
      workerId: null,
      leaseExpiresAt: null,
      errorMessage:
        "Worker stopped during provider upload. Check the provider dashboard before retrying to avoid duplicate assets.",
    },
  });
}

function monitorJob(
  jobId: string,
  workerId: string,
  controller: AbortController,
) {
  let phase: "DOWNLOADING" | "UPLOADING" = "DOWNLOADING";
  const timer = setInterval(() => {
    void (async () => {
      const current = await prisma.mediaIngestionJob.findUnique({
        where: { id: jobId },
        select: { status: true, workerId: true },
      });
      if (
        !current ||
        current.workerId !== workerId ||
        current.status !== phase
      ) {
        controller.abort(new Error(current?.status ?? "Job no longer active."));
        return;
      }
      await prisma.mediaIngestionJob.updateMany({
        where: { id: jobId, workerId, status: phase },
        data: { leaseExpiresAt: new Date(Date.now() + leaseDurationMs) },
      });
    })().catch((error: unknown) => {
      console.error("Media worker heartbeat failed.", error);
      controller.abort(new Error("Could not renew media job lease."));
    });
  }, 10_000);

  return {
    setPhase(next: "DOWNLOADING" | "UPLOADING") {
      phase = next;
    },
    stop() {
      clearInterval(timer);
    },
  };
}

function toPercentage(bytes: number, total: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((bytes / total) * 100)));
}

async function processJob(job: MediaIngestionJob, workerId: string): Promise<void> {
  const controller = new AbortController();
  controllers.add(controller);
  const monitor = monitorJob(job.id, workerId, controller);
  const filePath = getTempPath(job.id);
  const resumeMetadataPath = `${filePath}.resume.json`;
  let phase: "DOWNLOADING" | "UPLOADING" = "DOWNLOADING";

  try {
    await mkdir(tempDirectory, { recursive: true, mode: 0o700 });
    const episode = await prisma.episode.findUnique({
      where: { id: job.episodeId },
      select: {
        animeId: true,
        seasonId: true,
        title: true,
        episodeNumber: true,
        anime: { select: { title: true } },
        season: { select: { seasonNumber: true } },
      },
    });
    if (
      !episode ||
      episode.animeId !== job.animeId ||
      episode.seasonId !== job.seasonId
    ) {
      throw new Error("The selected episode relationships changed after queueing.");
    }

    const sourceUrl = decryptSourceUrl(job.encryptedSourceUrl);
    const downloadTimeout = setTimeout(
      () => controller.abort(new Error("Media download timed out.")),
      timeoutMs,
    );
    let downloaded: Awaited<ReturnType<typeof downloadAuthorizedVideo>>;
    try {
      downloaded = await downloadAuthorizedVideo({
        sourceUrl,
        destination: filePath,
        resumeMetadataPath,
        maxBytes: getMaxBytes(),
        timeoutMs,
        allowedHosts: getAllowedSourceHosts(),
        signal: controller.signal,
        onProgress: async (bytes, total) => {
          await prisma.mediaIngestionJob.updateMany({
            where: { id: job.id, workerId, status: "DOWNLOADING" },
            data: {
              downloadedBytes: bytes,
              downloadProgress: toPercentage(bytes, total),
              fileSize: total,
            },
          });
        },
      });
    } finally {
      clearTimeout(downloadTimeout);
    }

    const switched = await prisma.mediaIngestionJob.updateMany({
      where: { id: job.id, workerId, status: "DOWNLOADING" },
      data: {
        status: "UPLOADING",
        downloadProgress: 100,
        downloadedBytes: downloaded.fileSize,
        fileSize: downloaded.fileSize,
        leaseExpiresAt: new Date(Date.now() + leaseDurationMs),
      },
    });
    if (switched.count !== 1) {
      throw new Error("Job was paused or cancelled before upload.");
    }

    phase = "UPLOADING";
    monitor.setPhase(phase);
    const title = `${episode.anime.title} S${episode.season.seasonNumber}E${episode.episodeNumber} ${job.language}`;
    const asset = await uploadMediaAsset(
      job.provider,
      filePath,
      title,
      downloaded.mimeType,
      controller.signal,
      async (sent, total) => {
        await prisma.mediaIngestionJob.updateMany({
          where: { id: job.id, workerId, status: "UPLOADING" },
          data: { uploadProgress: toPercentage(sent, total) },
        });
      },
      async (providerAssetId) => {
        await prisma.mediaIngestionJob.updateMany({
          where: { id: job.id, workerId },
          data: { providerAssetId },
        });
      },
    );

    await prisma.$transaction(async (transaction) => {
      const completed = await transaction.mediaIngestionJob.updateMany({
        where: { id: job.id, workerId, status: "UPLOADING" },
        data: {
          status: "SUCCEEDED",
          uploadProgress: 100,
          providerAssetId: asset.providerAssetId,
          playbackReference: asset.playbackReference,
          errorMessage: null,
          workerId: null,
          leaseExpiresAt: null,
        },
      });
      if (completed.count !== 1) {
        throw new Error("Job was paused or cancelled before completion.");
      }
      await transaction.videoSource.upsert({
        where: { ingestionJobId: job.id },
        update: {
          provider: asset.providerName,
          sourceType: downloaded.sourceType,
          playbackReference: asset.playbackReference,
          isActive: false,
          language: job.language,
          providerAssetId: asset.providerAssetId,
          fileSize: downloaded.fileSize,
          durationSeconds: asset.durationSeconds,
        },
        create: {
          episodeId: job.episodeId,
          ingestionJobId: job.id,
          provider: asset.providerName,
          sourceType: downloaded.sourceType,
          playbackReference: asset.playbackReference,
          isActive: false,
          language: job.language,
          providerAssetId: asset.providerAssetId,
          fileSize: downloaded.fileSize,
          durationSeconds: asset.durationSeconds,
        },
      });
    });
    await rm(filePath, { force: true });
    console.info(`Media job ${job.id} finished; its source remains disabled pending admin approval.`);
  } catch (error) {
    const latest = await prisma.mediaIngestionJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });
    if (latest?.status === "PAUSED") {
      await prisma.mediaIngestionJob.updateMany({
        where: { id: job.id, workerId },
        data: { workerId: null, leaseExpiresAt: null },
      });
      return;
    }
    if (latest?.status === "CANCELLED") {
      await prisma.mediaIngestionJob.updateMany({
        where: { id: job.id, workerId },
        data: { workerId: null, leaseExpiresAt: null },
      });
      await rm(filePath, { force: true });
      await rm(resumeMetadataPath, { force: true });
      return;
    }
    if (shuttingDown) {
      await prisma.mediaIngestionJob.updateMany({
        where: { id: job.id, workerId },
        data: {
          status: phase === "DOWNLOADING" ? "QUEUED" : "FAILED",
          workerId: null,
          leaseExpiresAt: null,
          errorMessage:
            phase === "DOWNLOADING"
              ? "Worker stopped. The saved download can resume."
              : "Worker stopped during upload. Check the provider dashboard before retrying.",
        },
      });
      return;
    }

    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "Media job failed.";
    await prisma.mediaIngestionJob.updateMany({
      where: { id: job.id, workerId },
      data: {
        status: "FAILED",
        workerId: null,
        leaseExpiresAt: null,
        errorMessage: message,
      },
    });
    if (error instanceof MediaInputError) {
      await rm(filePath, { force: true });
      await rm(resumeMetadataPath, { force: true });
    }
    console.error(`Media job ${job.id} failed: ${message}`);
  } finally {
    monitor.stop();
    controllers.delete(controller);
  }
}

async function runWorker(slot: number): Promise<void> {
  const workerId = `${workerIdPrefix}:${slot}`;
  while (!shuttingDown) {
    try {
      await cleanupCancelledDownloads();
      const job = await claimJob(workerId);
      if (job) {
        await processJob(job, workerId);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error("Media worker loop failed.", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function main(): Promise<void> {
  if (!getAllowedSourceHosts().size) {
    throw new Error("Set MEDIA_ALLOWED_SOURCE_HOSTS before starting the media worker.");
  }
  await mkdir(tempDirectory, { recursive: true, mode: 0o700 });
  await recoverExpiredJobs();
  console.info(`ANIMEX media worker started with ${getConcurrency()} worker(s).`);
  const workers = Array.from({ length: getConcurrency() }, (_, slot) =>
    runWorker(slot + 1),
  );
  await Promise.all(workers);
}

function shutdown(): void {
  shuttingDown = true;
  for (const controller of controllers) {
    controller.abort(new Error("Worker is shutting down."));
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
