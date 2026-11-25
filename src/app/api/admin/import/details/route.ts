import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { findAnimeDuplicates } from "@/lib/anime-metadata-db";
import { animeMetadataErrorResponse } from "@/lib/anime-metadata-http";
import { getAnimeMetadataDetails } from "@/lib/anime-metadata";

const querySchema = z.object({
  provider: z.enum(["ANILIST", "JIKAN", "KITSU"]),
  id: z.string().regex(/^\d{1,12}$/),
  anilistId: z.coerce.number().int().positive().optional(),
  jikanId: z.coerce.number().int().positive().optional(),
  kitsuId: z.string().regex(/^\d{1,12}$/).optional(),
  title: z.string().trim().min(2).max(160),
});

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: "A valid provider and anime ID are required." }, { status: 400 });
  }

  try {
    const { provider, id, title, ...externalIds } = parsed.data;
    const result = await getAnimeMetadataDetails(provider, id, externalIds, title);
    const [existing] = await findAnimeDuplicates([result.media]);
    return Response.json({
      media: result.media,
      existing,
      fallbackUsed: result.fallbackUsed,
      warning: result.fallbackUsed
        ? `The selected provider was unavailable; previewing ${result.media.provider} metadata.`
        : null,
    });
  } catch (error) {
    return animeMetadataErrorResponse(error, "Anime provider detail lookup failed", "Anime details could not be loaded.");
  }
}
