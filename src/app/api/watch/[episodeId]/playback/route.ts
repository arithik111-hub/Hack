import { getDatabase } from "@/lib/db";
import { getSupabaseStorageClient, getVideoBucket } from "@/lib/supabase-storage";

export async function GET(_request: Request, context: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await context.params;

  try {
    const episode = await getDatabase().episode.findFirst({
      where: {
        id: episodeId,
        published: true,
        anime: { published: true },
      },
      select: {
        videoSources: {
          where: {
            isActive: true,
            provider: "Supabase Storage",
            sourceType: "MP4",
          },
          select: { playbackReference: true },
          take: 1,
        },
      },
    });

    const reference = episode?.videoSources[0]?.playbackReference;
    if (!reference) return Response.json({ error: "No published video source is available." }, { status: 404 });

    const separator = reference.indexOf("/");
    const bucket = reference.slice(0, separator);
    const objectPath = reference.slice(separator + 1);
    if (
      separator < 1 ||
      bucket !== getVideoBucket() ||
      !objectPath ||
      objectPath.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      return Response.json({ error: "Video source reference is invalid." }, { status: 500 });
    }

    const { data, error } = await getSupabaseStorageClient()
      .storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60 * 4);
    if (error || !data?.signedUrl) {
      return Response.json({ error: "A playback URL could not be created." }, { status: 502 });
    }

    return Response.json(
      { url: data.signedUrl },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Episode playback URL creation failed", error);
    return Response.json({ error: "Playback is temporarily unavailable." }, { status: 500 });
  }
}
