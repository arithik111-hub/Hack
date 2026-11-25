import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getCoverBucket, getSupabaseStorageClient } from "@/lib/supabase-storage";
import { detectRasterImage } from "@/lib/storage/image-validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function getUploadedCoverPath(poster: string, slug: string, bucket: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const posterUrl = new URL(poster);
    const baseUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (posterUrl.origin !== baseUrl.origin || !posterUrl.pathname.startsWith(prefix)) return null;

    const objectPath = decodeURIComponent(posterUrl.pathname.slice(prefix.length));
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ownedUpload = new RegExp(
      `^${escapedSlug}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|webp|avif)$`,
      "i",
    );
    return ownedUpload.test(objectPath) ? objectPath : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid cover upload request." }, { status: 400 });
  }

  const file = form.get("file");
  const slug = slugSchema.safeParse(form.get("slug"));
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (!slug.success) {
    return Response.json({ error: "Enter a valid anime slug before uploading." }, { status: 400 });
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
    const supabase = getSupabaseStorageClient();
    const bucket = getCoverBucket();
    const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(bucket);
    if (bucketError || !bucketInfo?.public) {
      return Response.json({ error: "The public anime cover bucket is not configured in Supabase Storage." }, { status: 503 });
    }

    const objectPath = `${slug.data}/${randomUUID()}.${image.extension}`;
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

    return Response.json({
      poster: supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl,
    });
  } catch (error) {
    console.error("New anime cover upload failed", error);
    return Response.json({ error: "Cover image could not be uploaded." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const parsed = z.object({
    poster: z.url(),
    slug: slugSchema,
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "A valid uploaded cover and anime slug are required." }, { status: 400 });
  }

  try {
    const bucket = getCoverBucket();
    const objectPath = getUploadedCoverPath(parsed.data.poster, parsed.data.slug, bucket);
    if (!objectPath) {
      return Response.json({ error: "This uploaded cover does not belong to that anime." }, { status: 400 });
    }

    const { error } = await getSupabaseStorageClient().storage.from(bucket).remove([objectPath]);
    if (error) {
      console.error("New anime cover removal failed", error);
      return Response.json({ error: "The uploaded cover could not be removed from Supabase Storage." }, { status: 502 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("New anime cover removal failed", error);
    return Response.json({ error: "The uploaded cover could not be removed." }, { status: 500 });
  }
}
