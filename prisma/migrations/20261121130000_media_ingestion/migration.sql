CREATE TYPE "MediaJobStatus" AS ENUM ('QUEUED', 'DOWNLOADING', 'UPLOADING', 'PAUSED', 'FAILED', 'CANCELLED', 'SUCCEEDED');
CREATE TYPE "VideoProvider" AS ENUM ('CLOUDFLARE_STREAM', 'BUNNY_STREAM', 'MUX');

ALTER TABLE "VideoSource"
  ADD COLUMN "language" TEXT,
  ADD COLUMN "providerAssetId" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "ingestionJobId" TEXT;

CREATE UNIQUE INDEX "VideoSource_ingestionJobId_key" ON "VideoSource"("ingestionJobId");

CREATE TABLE "MediaIngestionJob" (
  "id" TEXT NOT NULL,
  "animeId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "provider" "VideoProvider" NOT NULL,
  "status" "MediaJobStatus" NOT NULL DEFAULT 'QUEUED',
  "encryptedSourceUrl" TEXT NOT NULL,
  "sourceHost" TEXT NOT NULL,
  "authorizationNote" TEXT NOT NULL,
  "authorizationConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dedupeKey" TEXT NOT NULL,
  "downloadProgress" INTEGER NOT NULL DEFAULT 0,
  "uploadProgress" INTEGER NOT NULL DEFAULT 0,
  "downloadedBytes" INTEGER NOT NULL DEFAULT 0,
  "fileSize" INTEGER,
  "providerAssetId" TEXT,
  "playbackReference" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "workerId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaIngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaIngestionJob_dedupeKey_key" ON "MediaIngestionJob"("dedupeKey");
CREATE INDEX "MediaIngestionJob_status_createdAt_idx" ON "MediaIngestionJob"("status", "createdAt");
CREATE INDEX "MediaIngestionJob_workerId_leaseExpiresAt_idx" ON "MediaIngestionJob"("workerId", "leaseExpiresAt");
CREATE INDEX "MediaIngestionJob_episodeId_createdAt_idx" ON "MediaIngestionJob"("episodeId", "createdAt");

ALTER TABLE "MediaIngestionJob" ADD CONSTRAINT "MediaIngestionJob_animeId_fkey"
  FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaIngestionJob" ADD CONSTRAINT "MediaIngestionJob_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaIngestionJob" ADD CONSTRAINT "MediaIngestionJob_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaIngestionJob" ADD CONSTRAINT "MediaIngestionJob_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoSource" ADD CONSTRAINT "VideoSource_ingestionJobId_fkey"
  FOREIGN KEY ("ingestionJobId") REFERENCES "MediaIngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
