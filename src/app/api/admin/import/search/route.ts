import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { findAnimeDuplicates } from "@/lib/anime-metadata-db";
import { animeMetadataErrorResponse } from "@/lib/anime-metadata-http";
import { searchAnimeMetadata } from "@/lib/anime-metadata";

const filters = [
  "all",
  "popular",
  "recent",
  "airing",
  "completed",
  "upcoming",
  "movies",
  "tv",
] as const;

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const keyword = params.get("q")?.trim() ?? "";
  const parsedFilter = z.enum(filters).safeParse(params.get("filter") ?? "all");
  if (!parsedFilter.success) {
    return Response.json({ error: "Choose a supported anime filter." }, { status: 400 });
  }
  if (keyword.length > 80 || (keyword.length > 0 && keyword.length < 2)) {
    return Response.json({ error: "Search terms must contain between 2 and 80 characters." }, { status: 400 });
  }
  if (!keyword && parsedFilter.data === "all") {
    return Response.json({ error: "Enter a title or choose a catalogue filter." }, { status: 400 });
  }

  try {
    const result = await searchAnimeMetadata(keyword, parsedFilter.data);
    const duplicates = await findAnimeDuplicates(result.results);
    return Response.json({
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      warning: result.warning,
      results: result.results.map((metadata, index) => ({
        ...metadata,
        duplicate: duplicates[index],
      })),
    });
  } catch (error) {
    return animeMetadataErrorResponse(error, "Anime provider search failed", "Anime search could not be completed.");
  }
}
