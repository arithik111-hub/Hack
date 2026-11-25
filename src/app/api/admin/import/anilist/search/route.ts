import { requireAdmin } from "@/lib/auth";
import { searchAniListAnime, getAniListCover, AniListApiError } from "@/lib/anilist/client";
import { getDatabase } from "@/lib/db";

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const keyword = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (keyword.length < 2 || keyword.length > 80) {
    return Response.json({ error: "Enter a search term between 2 and 80 characters." }, { status: 400 });
  }

  try {
    const items = await searchAniListAnime(keyword);
    const records = await getDatabase().anime.findMany({
      where: {
        OR: [
          { anilistId: { in: items.map((item) => item.id) } },
          { title: { in: items.flatMap((item) => [item.title?.english, item.title?.romaji, item.title?.native]).filter((title): title is string => Boolean(title)), mode: "insensitive" } },
        ],
      },
      select: { id: true, anilistId: true, title: true, slug: true },
    });

    const results = items.map((item) => ({
      ...item,
      cover: getAniListCover(item),
      duplicate: records.find((record) =>
        record.anilistId === item.id ||
        [item.title?.english, item.title?.romaji, item.title?.native]
          .some((title) => title?.toLowerCase() === record.title.toLowerCase()),
      ) ?? null,
    }));
    return Response.json({ results });
  } catch (error) {
    if (error instanceof AniListApiError) {
      return Response.json(
        { error: error.retryAfter ? `${error.message} Retry after ${error.retryAfter} seconds.` : error.message, retryAfter: error.retryAfter },
        { status: error.status === 401 ? 502 : error.status },
      );
    }
    console.error("AniList search failed", error);
    return Response.json({ error: "Search could not be completed." }, { status: 500 });
  }
}
