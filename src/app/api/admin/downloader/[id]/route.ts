import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "retry", "approve"]),
  publishEpisode: z.boolean().optional(),
});

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return (
      new URL(origin).origin ===
      new URL(process.env.NEXTAUTH_URL ?? request.url).origin
    );
  } catch {
    return false;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.string().cuid().safeParse(id).success) {
    return Response.json({ error: "Invalid media job." }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid media job action." }, { status: 400 });
  }

  const db = getDatabase();
  try {
    const job = await db.mediaIngestionJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        workerId: true,
        attempts: true,
        providerAssetId: true,
        episodeId: true,
        videoSource: { select: { id: true } },
      },
    });
    if (!job) return Response.json({ error: "Media job not found." }, { status: 404 });

    if (parsed.data.action === "pause") {
      if (!["QUEUED", "DOWNLOADING"].includes(job.status)) {
        return Response.json({ error: "This job cannot be paused." }, { status: 409 });
      }
      const changed = await db.mediaIngestionJob.updateMany({
        where: { id, status: job.status, workerId: job.workerId },
        data: {
          status: "PAUSED",
          ...(job.workerId ? {} : { leaseExpiresAt: null }),
        },
      });
      if (changed.count !== 1) {
        return Response.json({ error: "The job changed before it could be paused." }, { status: 409 });
      }
    } else if (parsed.data.action === "cancel") {
      if (!["QUEUED", "DOWNLOADING", "UPLOADING", "PAUSED"].includes(job.status)) {
        return Response.json({ error: "This job cannot be cancelled." }, { status: 409 });
      }
      const changed = await db.mediaIngestionJob.updateMany({
        where: { id, status: job.status, workerId: job.workerId },
        data: {
          status: "CANCELLED",
          ...(job.workerId
            ? {}
            : { workerId: null, leaseExpiresAt: null }),
        },
      });
      if (changed.count !== 1) {
        return Response.json({ error: "The job changed before it could be cancelled." }, { status: 409 });
      }
    } else if (parsed.data.action === "resume") {
      if (job.status !== "PAUSED" || job.workerId) {
        return Response.json(
          { error: "A paused job can resume after its worker has stopped." },
          { status: 409 },
        );
      }
      const changed = await db.mediaIngestionJob.updateMany({
        where: { id, status: "PAUSED", workerId: null },
        data: { status: "QUEUED", errorMessage: null },
      });
      if (changed.count !== 1) {
        return Response.json({ error: "The job changed before it could be resumed." }, { status: 409 });
      }
    } else if (parsed.data.action === "retry") {
      if (job.status !== "FAILED" || job.attempts >= 3 || job.providerAssetId) {
        return Response.json(
          {
            error:
              "This job cannot be retried automatically. Check the provider dashboard first, or create a new job after resolving the existing asset.",
          },
          { status: 409 },
        );
      }
      const changed = await db.mediaIngestionJob.updateMany({
        where: { id, status: "FAILED", attempts: job.attempts, providerAssetId: null },
        data: {
          status: "QUEUED",
          errorMessage: null,
          downloadProgress: 0,
          uploadProgress: 0,
          downloadedBytes: 0,
          fileSize: null,
        },
      });
      if (changed.count !== 1) {
        return Response.json({ error: "The job changed before it could be retried." }, { status: 409 });
      }
    } else {
      if (job.status !== "SUCCEEDED" || !job.videoSource) {
        return Response.json(
          { error: "Only successfully uploaded assets can be approved." },
          { status: 409 },
        );
      }
      await db.$transaction([
        db.videoSource.update({
          where: { ingestionJobId: id },
          data: { isActive: true },
        }),
        ...(parsed.data.publishEpisode
          ? [
              db.episode.update({
                where: { id: job.episodeId },
                data: { published: true },
              }),
            ]
          : []),
      ]);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Media job action could not be completed.",
      },
      { status: 500 },
    );
  }
}
