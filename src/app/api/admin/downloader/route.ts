import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { encryptSourceUrl } from "@/lib/media/source-crypto";
import {
  getAllowedSourceHosts,
  MediaInputError,
  validateSourceUrl,
} from "@/lib/media/source-validation";
import { getProviderConfigurations } from "@/lib/media/providers";
import { createMediaJobDedupeKey } from "@/lib/media/job-dedupe";

const createJobSchema = z.object({
  episodeId: z.string().cuid(),
  language: z.string().trim().min(2).max(16).regex(/^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})?$/),
  provider: z.enum(["CLOUDFLARE_STREAM", "BUNNY_STREAM", "MUX"]),
  sourceUrl: z.url().max(2048),
  authorizationNote: z.string().trim().min(15).max(1000),
  authorizationConfirmed: z.literal(true),
});

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(
      process.env.NEXTAUTH_URL ?? request.url,
    );
    return originUrl.origin === expectedUrl.origin;
  } catch {
    return false;
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });

  try {
    const db = getDatabase();
    const [episodes, jobs] = await Promise.all([
      db.episode.findMany({
        orderBy: [
          { anime: { title: "asc" } },
          { season: { seasonNumber: "asc" } },
          { episodeNumber: "asc" },
        ],
        select: {
          id: true,
          title: true,
          episodeNumber: true,
          anime: { select: { id: true, title: true } },
          season: { select: { id: true, title: true, seasonNumber: true } },
        },
      }),
      db.mediaIngestionJob.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          episodeId: true,
          language: true,
          provider: true,
          status: true,
          sourceHost: true,
          authorizationNote: true,
          downloadProgress: true,
          uploadProgress: true,
          downloadedBytes: true,
          fileSize: true,
          providerAssetId: true,
          attempts: true,
          errorMessage: true,
          workerId: true,
          createdAt: true,
          updatedAt: true,
          episode: {
            select: {
              title: true,
              episodeNumber: true,
              anime: { select: { title: true } },
              season: { select: { title: true, seasonNumber: true } },
            },
          },
          videoSource: { select: { isActive: true } },
        },
      }),
    ]);

    return Response.json({
      episodes,
      jobs,
      providers: getProviderConfigurations(),
      allowedSourceHosts: [...getAllowedSourceHosts()],
      encryptionConfigured: /^[a-fA-F0-9]{64}$/.test(
        process.env.MEDIA_JOB_ENCRYPTION_KEY ?? "",
      ),
      workerCommand: "npm run media:worker",
      maxFileSizeBytes: Number(
        process.env.MEDIA_MAX_FILE_BYTES ?? 1_073_741_824,
      ),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Media jobs could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = createJobSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the authorized media job fields and confirm media rights.",
        fields: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const hosts = getAllowedSourceHosts();
  if (!hosts.size) {
    return Response.json(
      { error: "Set MEDIA_ALLOWED_SOURCE_HOSTS before creating download jobs." },
      { status: 503 },
    );
  }
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.MEDIA_JOB_ENCRYPTION_KEY ?? "")) {
    return Response.json(
      { error: "Set MEDIA_JOB_ENCRYPTION_KEY before creating download jobs." },
      { status: 503 },
    );
  }
  const providerConfig = getProviderConfigurations()[parsed.data.provider];
  if (!providerConfig.configured) {
    return Response.json(
      {
        error: `Selected provider is not configured. Missing: ${providerConfig.missing.join(", ")}.`,
      },
      { status: 503 },
    );
  }

  try {
    const validated = await validateSourceUrl(parsed.data.sourceUrl, hosts);
    const db = getDatabase();
    const episode = await db.episode.findUnique({
      where: { id: parsed.data.episodeId },
      select: {
        id: true,
        animeId: true,
        seasonId: true,
      },
    });
    if (!episode) {
      return Response.json({ error: "Selected episode was not found." }, { status: 404 });
    }

    const activeJobs = await db.mediaIngestionJob.count({
      where: { status: { in: ["QUEUED", "DOWNLOADING", "UPLOADING"] } },
    });
    if (activeJobs >= 100) {
      return Response.json(
        { error: "The media queue is full. Wait for active jobs to finish." },
        { status: 429 },
      );
    }

    const job = await db.mediaIngestionJob.create({
      data: {
        animeId: episode.animeId,
        seasonId: episode.seasonId,
        episodeId: episode.id,
        createdById: admin.id,
        language: parsed.data.language.toLowerCase(),
        provider: parsed.data.provider,
        encryptedSourceUrl: encryptSourceUrl(validated.url.toString()),
        sourceHost: validated.url.hostname,
        authorizationNote: parsed.data.authorizationNote,
        dedupeKey: createMediaJobDedupeKey(
          episode.id,
          parsed.data.language,
          validated.url.toString(),
        ),
      },
      select: { id: true, status: true, createdAt: true },
    });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "This episode, language, and source already have an import job." },
        { status: 409 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Media job could not be queued.",
      },
      { status: 500 },
    );
  }
}
