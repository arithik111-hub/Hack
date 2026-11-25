import "server-only";
import { getDatabase } from "@/lib/db";
import type { Anime, Episode, Season } from "@/data/anime";

export async function getPublishedAnimeCatalog(): Promise<Anime[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to load the public anime catalogue.");

  const records = await getDatabase().anime.findMany({
    where: { published: true },
    include: { genres: { include: { genre: true } } },
    orderBy: [{ featured: "desc" }, { popularity: "desc" }, { rating: "desc" }],
  });

  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    title: record.title,
    romajiTitle: record.romajiTitle,
    japaneseTitle: record.japaneseTitle,
    alternativeTitles: record.alternativeTitle
      ? record.alternativeTitle.split(" · ").filter(Boolean)
      : [],
    description: record.description,
    poster: record.poster,
    banner: record.banner,
    rating: record.rating,
    popularity: record.popularity,
    featured: record.featured,
    releaseYear: record.releaseYear,
    season: record.season,
    durationMinutes: record.durationMinutes,
    sourceMaterial: record.sourceMaterial,
    officialWebsite: record.officialWebsite,
    genres: record.genres.map((entry) => entry.genre.name) as Anime["genres"][number][],
    studio: record.studio,
    status: record.status === "AIRING" ? "Airing" : record.status === "UPCOMING" ? "Upcoming" : "Completed",
    type: record.type as Anime["type"],
    languages: record.languages,
    totalEpisodes: record.totalEpisodes,
    accent: "#704be0",
    createdAt: record.createdAt.toISOString(),
    ...(record.metadataSource !== "MANUAL"
      ? { source: record.metadataSource }
      : record.jikanId
        ? { source: "JIKAN" as const }
        : record.anilistId
          ? { source: "ANILIST" as const }
          : {}),
  }));
}

export async function getPublishedAnimeBySlug(slug: string): Promise<Anime | undefined> {
  const catalog = await getPublishedAnimeCatalog();
  return catalog.find((anime) => anime.slug === slug);
}

export async function getPublishedEpisodeById(episodeId: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to load published episodes.");
  const record = await getDatabase().episode.findFirst({
    where: { id: episodeId, published: true, anime: { published: true } },
    include: {
      anime: { include: { genres: { include: { genre: true } } } },
      videoSources: {
        where: { isActive: true, provider: "Supabase Storage", sourceType: "MP4" },
        take: 1,
      },
    },
  });
  if (!record) return null;
  const anime = (await getPublishedAnimeCatalog()).find((entry) => entry.id === record.animeId);
  if (!anime) return null;
  return {
    anime,
    episode: {
      id: record.id,
      animeId: record.animeId,
      seasonId: record.seasonId,
      episodeNumber: record.episodeNumber,
      title: record.title,
      description: record.description,
      thumbnail: record.thumbnail,
      duration: record.duration,
      releaseDate: record.releaseDate.toISOString().slice(0, 10),
      playbackAvailable: record.videoSources.length > 0,
    } satisfies Episode,
  };
}

export async function getPublishedAnimeSeasons(animeId: string): Promise<Season[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to load anime seasons.");
  const db = getDatabase();
  const anime = await db.anime.findFirst({
    where: { id: animeId, published: true },
    select: { id: true },
  });
  if (!anime) return [];
  const records = await db.season.findMany({
    where: { animeId },
    orderBy: { seasonNumber: "asc" },
  });
  return records.map((record) => ({
    id: record.id,
    animeId: record.animeId,
    seasonNumber: record.seasonNumber,
    title: record.title,
    episodeCount: record.episodeCount,
  }));
}

export async function getPublishedAnimeEpisodes(animeId: string, seasonId: string): Promise<Episode[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to load anime episodes.");
  const records = await getDatabase().episode.findMany({
    where: { animeId, seasonId, published: true, anime: { published: true } },
    orderBy: { episodeNumber: "asc" },
    include: {
      videoSources: {
        where: {
          isActive: true,
          provider: "Supabase Storage",
          sourceType: "MP4",
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  return records.map((record) => ({
    id: record.id,
    animeId: record.animeId,
    seasonId: record.seasonId,
    episodeNumber: record.episodeNumber,
    title: record.title,
    description: record.description,
    thumbnail: record.thumbnail,
    duration: record.duration,
    releaseDate: record.releaseDate.toISOString().slice(0, 10),
    playbackAvailable: record.videoSources.length > 0,
  }));
}
