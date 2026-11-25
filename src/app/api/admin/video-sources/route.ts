import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getSupabaseStorageClient, getVideoBucket } from "@/lib/supabase-storage";

const deleteSchema = z.object({
  id: z.string().cuid(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });

  try {
    const db = getDatabase();
    const [episodes, sources, bucketConfigured] = await Promise.all([
      db.episode.findMany({
        orderBy: [{ animeId: "asc" }, { seasonId: "asc" }, { episodeNumber: "asc" }],
        include: {
          anime: { select: { title: true } },
          season: { select: { title: true } },
        },
      }),
      db.videoSource.findMany({
        orderBy: { id: "desc" },
        include: {
          episode: {
            select: {
              title: true,
              episodeNumber: true,
              anime: { select: { title: true } },
            },
          },
        },
      }),
      Promise.resolve(Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)),
    ]);
    return Response.json({ episodes, sources, bucket: getVideoBucket(), bucketConfigured });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video source data unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const manualSchema = z.object({
      episodeId: z.string().cuid(),
      provider: z.string().trim().min(2).max(100),
      sourceType: z.enum(["EMBED", "HLS", "MP4", "OTHER"]),
      playbackReference: z.string().trim().min(1).max(4000),
      isActive: z.boolean(),
    });
    const parsed = manualSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Please check the authorized source fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    if (!/^https?:\/\//i.test(parsed.data.playbackReference) && parsed.data.sourceType !== "HLS") {
      return Response.json({ error: "Playback URLs must begin with http:// or https://." }, { status: 400 });
    }
    try {
      const db = getDatabase();
      await db.videoSource.create({ data: parsed.data });
      return Response.json({ success: true, message: "Authorized video source saved." });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Video source could not be saved." }, { status: 500 });
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const episodeId = String(form.get("episodeId") ?? "");
  if (!z.string().cuid().safeParse(episodeId).success) {
    return Response.json({ error: "A valid episode is required." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Select a video file." }, { status: 400 });
  }

  const allowedTypes = new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]);
  if (!allowedTypes.has(file.type)) {
    return Response.json(
      { error: "Only MP4, WebM, and QuickTime video files are allowed." },
      { status: 400 },
    );
  }
  if (file.size > 100 * 1024 * 1024) {
    return Response.json(
      { error: "Video files must be 100 MB or smaller." },
      { status: 413 },
    );
  }

  try {
    const db = getDatabase();
    const episode = await db.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, title: true },
    });
    if (!episode) {
      return Response.json({ error: "Episode not found." }, { status: 404 });
    }

    const supabase = getSupabaseStorageClient();
    const bucket = getVideoBucket();
    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const objectPath = `${episodeId}/${Date.now()}-${safeName || "video.mp4"}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return Response.json(
        { error: `Supabase upload failed: ${uploadError.message}` },
        { status: 502 },
      );
    }

    try {
      await db.videoSource.create({
        data: {
          episodeId,
          provider: "Supabase Storage",
          sourceType: file.type === "video/webm" ? "OTHER" : "MP4",
          playbackReference: `${bucket}/${objectPath}`,
          isActive: true,
        },
      });
    } catch (databaseError) {
      await supabase.storage.from(bucket).remove([objectPath]);
      throw databaseError;
    }

    return Response.json({
      success: true,
      message: `${episode.title} now has a Supabase video source.`,
      objectPath,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video upload failed." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({ id: z.string().cuid(), isActive: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid video source status." }, { status: 400 });
  try {
    await getDatabase().videoSource.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Video source status could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid video source." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const source = await db.videoSource.findUnique({
      where: { id: parsed.data.id },
      select: { playbackReference: true, provider: true },
    });
    if (!source) {
      return Response.json({ error: "Video source not found." }, { status: 404 });
    }

    await db.videoSource.delete({ where: { id: parsed.data.id } });

    if (source.provider === "Supabase Storage") {
      const slash = source.playbackReference.indexOf("/");
      if (slash > 0) {
        const bucket = source.playbackReference.slice(0, slash);
        const objectPath = source.playbackReference.slice(slash + 1);
        await getSupabaseStorageClient().storage.from(bucket).remove([objectPath]);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video source could not be deleted." },
      { status: 500 },
    );
  }
}
