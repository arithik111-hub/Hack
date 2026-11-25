import { requireAdmin } from "@/lib/auth";
import { getJikanCover, JikanApiError, searchJikanAnime } from "@/lib/jikan/client";
import { getDatabase } from "@/lib/db";

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const keyword = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (keyword.length < 2 || keyword.length > 80) {
    return Response.json({ error: "Enter a search term between 2 and 80 characters." }, { status: 400 });
  }

  try {
    const items = await searchJikanAnime(keyword);
    const titles = items.flatMap((item) => [item.title_english, item.title, item.title_japanese])
      .filter((title): title is string => Boolean(title));
    const records = await getDatabase().anime.findMany({
      where: {
        OR: [
          { jikanId: { in: items.map((item) => item.mal_id) } },
          { title: { in: titles, mode: "insensitive" } },
        ],
      },
      select: { id: true, jikanId: true, title: true, slug: true },
    });

    const results = items.map((item) => ({
      ...item,
      cover: getJikanCover(item),
      duplicate: records.find((record) =>
        record.jikanId === item.mal_id ||
        [item.title_english, item.title, item.title_japanese]
          .some((title) => title?.toLowerCase() === record.title.toLowerCase()),
      ) ?? null,
    }));
    return Response.json({ results });
  } catch (error) {
    if (error instanceof JikanApiError) {
      return Response.json(
        {
          error: error.retryAfter
            ? `${error.message} Retry after ${error.retryAfter} seconds.`
            : error.message,
          retryAfter: error.retryAfter,
        },
        { status: error.status },
      );
    }
    console.error("Jikan search failed", error);
    return Response.json({ error: "Search could not be completed." }, { status: 500 });
  }
}
