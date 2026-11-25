import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getCoverBucket, getSupabaseStorageClient } from "@/lib/supabase-storage";
import { detectRasterImage } from "@/lib/storage/image-validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const animeIdSchema = z.string().cuid();

function getStoredObjectPath(urlValue: string, bucket: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const url = new URL(urlValue);
    const base = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await context.params;
  if (!animeIdSchema.safeParse(id).success) {
    return Response.json({ error: "A valid anime ID is required." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid cover upload request." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "The selected image is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "Cover images must be 10 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectRasterImage(bytes);
  if (!image) {
    return Response.json({ error: "Upload a PNG, JPEG, WebP, or AVIF image." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const anime = await db.anime.findUnique({
      where: { id },
      select: { id: true, slug: true, poster: true, customPoster: true },
    });
    if (!anime) return Response.json({ error: "Anime not found." }, { status: 404 });

    const supabase = getSupabaseStorageClient();
    const bucket = getCoverBucket();
    const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(bucket);
    if (bucketError || !bucketInfo?.public) {
      return Response.json({ error: "The public anime cover bucket is not configured in Supabase Storage." }, { status: 503 });
    }

    const objectPath = `${anime.slug}/${randomUUID()}.${image.extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: image.contentType,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      return Response.json({ error: `Supabase cover upload failed: ${uploadError.message}` }, { status: 502 });
    }

    const poster = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
    try {
      await db.anime.update({ where: { id: anime.id }, data: { poster, customPoster: true } });
    } catch (databaseError) {
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([objectPath]);
      console.error("Anime cover database update failed", databaseError);
      return Response.json({
        error: cleanupError
          ? "The cover could not be saved to the anime record, and the uploaded file could not be removed."
          : "The cover could not be saved to the anime record.",
      }, { status: 500 });
    }

    const previousObjectPath = getStoredObjectPath(anime.poster, bucket);
    if (previousObjectPath) {
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([previousObjectPath]);
      if (cleanupError) {
        console.error("Previous anime cover cleanup failed", cleanupError);
        return Response.json({
          poster,
          warning: "The new cover is saved, but the previous stored cover could not be removed.",
        });
      }
    }

    return Response.json({ poster });
  } catch (error) {
    console.error("Anime cover upload failed", error);
    return Response.json({ error: "Cover image could not be uploaded." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await context.params;
  if (!animeIdSchema.safeParse(id).success) {
    return Response.json({ error: "A valid anime ID is required." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const anime = await db.anime.findUnique({
      where: { id },
      select: { id: true, poster: true, customPoster: true },
    });
    if (!anime) return Response.json({ error: "Anime not found." }, { status: 404 });

    const bucket = getCoverBucket();
    const objectPath = getStoredObjectPath(anime.poster, bucket);
    if (!anime.customPoster || !objectPath) {
      return Response.json({ error: "This anime has no removable Supabase cover." }, { status: 400 });
    }

    const placeholder = "/images/anime-cover-placeholder.svg";
    await db.anime.update({
      where: { id: anime.id },
      data: { poster: placeholder, customPoster: false },
    });

    const { error: removeError } = await getSupabaseStorageClient()
      .storage.from(bucket).remove([objectPath]);
    if (removeError) {
      try {
        await db.anime.update({
          where: { id: anime.id },
          data: { poster: anime.poster, customPoster: anime.customPoster },
        });
      } catch (restoreError) {
        console.error("Anime cover reference restore failed", restoreError);
        return Response.json({
          error: "The cover could not be removed from Supabase, and its anime record could not be restored.",
        }, { status: 500 });
      }
      console.error("Anime cover removal failed", removeError);
      return Response.json({ error: "The cover could not be removed from Supabase Storage." }, { status: 502 });
    }

    return Response.json({ success: true, poster: placeholder });
  } catch (error) {
    console.error("Anime cover removal failed", error);
    return Response.json({ error: "The anime cover could not be removed." }, { status: 500 });
  }
}
