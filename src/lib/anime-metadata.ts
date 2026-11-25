import {
  type AnimeCatalogueFilter,
  type AniListMedia,
  AniListApiError,
  getAniListAnime,
  getAniListBanner,
  getAniListCover,
  isAniListImageUrl,
  searchAniListAnime,
} from "@/lib/anilist/client";
import {
  getJikanAnime,
  getJikanCover,
  isJikanImageUrl,
  JikanApiError,
  searchJikanAnime,
  type JikanAnime,
} from "@/lib/jikan/client";
import {
  getKitsuAnime,
  getKitsuBanner,
  getKitsuCover,
  isKitsuImageUrl,
  KitsuApiError,
  searchKitsuAnime,
  type KitsuAnime,
} from "@/lib/kitsu/client";

export type MetadataProvider = "ANILIST" | "JIKAN" | "KITSU";
export type AnimeCatalogueStatus = "AIRING" | "COMPLETED" | "UPCOMING";
export type AnimeCatalogueType = "TV" | "Movie" | "OVA" | "ONA";

export type AnimeMetadata = {
  provider: MetadataProvider;
  providerId: string;
  anilistId: number | null;
  jikanId: number | null;
  kitsuId: string | null;
  title: string;
  romajiTitle: string | null;
  japaneseTitle: string | null;
  alternativeTitle: string | null;
  description: string;
  poster: string | null;
  banner: string | null;
  releaseYear: number | null;
  season: string | null;
  durationMinutes: number | null;
  sourceMaterial: string | null;
  officialWebsite: string | null;
  rating: number | null;
  popularity: number | null;
  status: AnimeCatalogueStatus | null;
  type: AnimeCatalogueType | null;
  totalEpisodes: number | null;
  studio: string | null;
  genres: string[];
};

type ProviderFailure = {
  provider: MetadataProvider;
  message: string;
  status: number;
  retryAfter: string | null;
};

type SearchResult = {
  provider: MetadataProvider | null;
  results: AnimeMetadata[];
  fallbackUsed: boolean;
  warning: string | null;
};

type ExternalIds = {
  anilistId?: number | null;
  jikanId?: number | null;
  kitsuId?: string | null;
};

export type AnimeMetadataClients = {
  anilist: {
    search: typeof searchAniListAnime;
    details: typeof getAniListAnime;
  };
  jikan: {
    search: typeof searchJikanAnime;
    details: typeof getJikanAnime;
  };
  kitsu: {
    search: typeof searchKitsuAnime;
    details: typeof getKitsuAnime;
  };
};

const defaultClients: AnimeMetadataClients = {
  anilist: { search: searchAniListAnime, details: getAniListAnime },
  jikan: { search: searchJikanAnime, details: getJikanAnime },
  kitsu: { search: searchKitsuAnime, details: getKitsuAnime },
};

export function sanitizeAnimeDescription(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

export function isTrustedAnimeImageUrl(value: string) {
  if (value === "/images/anime-cover-placeholder.svg") return true;
  if (isAniListImageUrl(value) || isJikanImageUrl(value) || isKitsuImageUrl(value)) return true;

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl);
    const bucket = process.env.SUPABASE_COVER_BUCKET?.trim() || "animex-covers";
    return url.protocol === "https:" &&
      url.origin === base.origin &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
  } catch {
    return false;
  }
}

function safeWebsite(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mapStatus(value: string | null | undefined): AnimeCatalogueStatus | null {
  switch (value?.toUpperCase()) {
    case "RELEASING":
    case "CURRENTLY AIRING":
    case "CURRENT":
      return "AIRING";
    case "NOT_YET_RELEASED":
    case "NOT YET AIRED":
    case "UPCOMING":
      return "UPCOMING";
    case "FINISHED":
    case "FINISHED AIRING":
    case "COMPLETE":
    case "COMPLETED":
      return "COMPLETED";
    default:
      return null;
  }
}

function mapType(value: string | null | undefined): AnimeCatalogueType | null {
  switch (value?.toUpperCase()) {
    case "TV":
    case "TV_SHORT":
      return "TV";
    case "MOVIE":
      return "Movie";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    default:
      return null;
  }
}

function parseDuration(value: string | null | undefined) {
  if (!value) return null;
  const hours = value.match(/(\d+)\s*(?:hr|hour)/i);
  const minutes = value.match(/(\d+)\s*min/i);
  const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  return total > 0 ? total : null;
}

function seasonFromDate(value: string | null | undefined) {
  if (!value) return null;
  const month = Number(value.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (month <= 3) return "WINTER";
  if (month <= 6) return "SPRING";
  if (month <= 9) return "SUMMER";
  return "FALL";
}

function officialLink(links: Array<{ site: string; url: string }> | null | undefined) {
  const link = links?.find((item) => /official/i.test(item.site));
  return safeWebsite(link?.url);
}

function titleKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeAniList(media: AniListMedia): AnimeMetadata {
  const title = media.title?.english || media.title?.romaji || media.title?.native || "";
  const alternatives = [
    media.title?.romaji,
    media.title?.native,
  ].filter((value): value is string => Boolean(value && value !== title));
  return {
    provider: "ANILIST",
    providerId: String(media.id),
    anilistId: media.id,
    jikanId: media.idMal ?? null,
    kitsuId: null,
    title,
    romajiTitle: media.title?.romaji ?? null,
    japaneseTitle: media.title?.native ?? null,
    alternativeTitle: [...new Set(alternatives)].join(" · ") || null,
    description: sanitizeAnimeDescription(media.description),
    poster: getAniListCover(media),
    banner: getAniListBanner(media),
    releaseYear: media.seasonYear ?? null,
    season: media.season ?? null,
    durationMinutes: media.duration ?? null,
    sourceMaterial: media.source ?? null,
    officialWebsite: officialLink(media.externalLinks),
    rating: media.averageScore == null ? null : media.averageScore / 10,
    popularity: media.popularity ?? null,
    status: mapStatus(media.status),
    type: mapType(media.format),
    totalEpisodes: media.episodes ?? null,
    studio: media.studios?.nodes.map((studio) => studio.name).join(", ") || null,
    genres: media.genres ?? [],
  };
}

function normalizeJikan(media: JikanAnime): AnimeMetadata {
  const title = media.title_english || media.title;
  const alternatives = [
    ...(media.title_synonyms ?? []),
    media.title,
    media.title_japanese,
  ].filter((value): value is string => Boolean(value && value !== title));
  const yearText = media.aired?.from?.slice(0, 4);
  const releaseYear = media.year ?? (yearText ? Number(yearText) : null);
  const rank = media.popularity ?? null;
  return {
    provider: "JIKAN",
    providerId: String(media.mal_id),
    anilistId: null,
    jikanId: media.mal_id,
    kitsuId: null,
    title,
    romajiTitle: media.title,
    japaneseTitle: media.title_japanese ?? null,
    alternativeTitle: [...new Set(alternatives)].join(" · ") || null,
    description: sanitizeAnimeDescription(media.synopsis),
    poster: getJikanCover(media),
    banner: getJikanCover(media),
    releaseYear: releaseYear && Number.isInteger(releaseYear) ? releaseYear : null,
    season: media.season?.toUpperCase() ?? null,
    durationMinutes: parseDuration(media.duration),
    sourceMaterial: media.source ?? null,
    officialWebsite: safeWebsite(media.external?.find((link) => /official/i.test(link.name))?.url),
    rating: media.score ?? null,
    popularity: rank === null ? null : Math.max(0, 1_000_000 - rank),
    status: mapStatus(media.status),
    type: mapType(media.type),
    totalEpisodes: media.episodes ?? null,
    studio: media.studios?.map((studio) => studio.name).join(", ") || null,
    genres: media.genres?.map((genre) => genre.name) ?? [],
  };
}

function normalizeKitsu(media: KitsuAnime): AnimeMetadata {
  const title = media.titles?.en || media.titles?.en_us || media.canonicalTitle || media.titles?.en_jp || "";
  const alternatives = [
    media.titles?.en_jp,
    media.titles?.ja_jp,
    ...media.abbreviatedTitles,
  ].filter((value): value is string => Boolean(value && value !== title));
  const parsedRating = Number(media.averageRating);
  const popularity = media.userCount ??
    (media.popularityRank === null ? null : Math.max(0, 1_000_000 - media.popularityRank));
  return {
    provider: "KITSU",
    providerId: media.id,
    anilistId: media.anilistId,
    jikanId: media.jikanId,
    kitsuId: media.id,
    title,
    romajiTitle: media.titles?.en_jp ?? null,
    japaneseTitle: media.titles?.ja_jp ?? null,
    alternativeTitle: [...new Set(alternatives)].join(" · ") || null,
    description: sanitizeAnimeDescription(media.synopsis ?? media.description),
    poster: getKitsuCover(media),
    banner: getKitsuBanner(media),
    releaseYear: media.seasonYear ?? (media.startDate ? Number(media.startDate.slice(0, 4)) : null),
    season: seasonFromDate(media.startDate),
    durationMinutes: media.episodeLength,
    sourceMaterial: null,
    officialWebsite: null,
    rating: Number.isFinite(parsedRating) ? parsedRating / 10 : null,
    popularity,
    status: mapStatus(media.status),
    type: mapType(media.subtype),
    totalEpisodes: media.episodeCount,
    studio: media.studios.join(", ") || null,
    genres: media.genres,
  };
}

function providerFailure(provider: MetadataProvider, error: unknown): ProviderFailure {
  const typedError =
    error instanceof AniListApiError ||
    error instanceof JikanApiError ||
    error instanceof KitsuApiError
      ? error
      : null;
  return {
    provider,
    message: typedError?.message ?? "The provider could not be reached.",
    status: typedError?.status ?? 502,
    retryAfter: typedError?.retryAfter ?? null,
  };
}

export class AnimeMetadataError extends Error {
  constructor(
    message: string,
    readonly failures: ProviderFailure[],
  ) {
    super(message);
    this.name = "AnimeMetadataError";
  }

  get retryAfter() {
    return this.failures.find((failure) => failure.retryAfter)?.retryAfter ?? null;
  }

  get status() {
    return this.failures.length > 0 && this.failures.every((failure) => failure.status === 429)
      ? 429
      : 503;
  }
}

export function createAnimeMetadataService(clients: AnimeMetadataClients = defaultClients) {
  async function search(keyword: string, filter: AnimeCatalogueFilter): Promise<SearchResult> {
    const failures: ProviderFailure[] = [];
    const providers: Array<{
      name: MetadataProvider;
      search: (query: string, catalogueFilter: AnimeCatalogueFilter) => Promise<AnimeMetadata[]>;
    }> = [
      {
        name: "ANILIST",
        search: async (query, catalogueFilter) =>
          (await clients.anilist.search(query, catalogueFilter)).map(normalizeAniList),
      },
      {
        name: "JIKAN",
        search: async (query, catalogueFilter) =>
          (await clients.jikan.search(query, catalogueFilter)).map(normalizeJikan),
      },
      {
        name: "KITSU",
        search: async (query, catalogueFilter) =>
          (await clients.kitsu.search(query, catalogueFilter)).map(normalizeKitsu),
      },
    ];

    for (const provider of providers) {
      try {
        const results = await provider.search(keyword, filter);
        if (results.length) {
          return {
            provider: provider.name,
            results,
            fallbackUsed: provider.name !== "ANILIST",
            warning: failures.length
              ? `${failures.map((failure) => failure.provider).join(", ")} unavailable; showing ${provider.name} results.`
              : provider.name === "ANILIST"
                ? null
                : `No AniList matches; showing ${provider.name} results.`,
          };
        }
      } catch (error) {
        failures.push(providerFailure(provider.name, error));
      }
    }

    if (failures.length === providers.length) {
      throw new AnimeMetadataError(
        "AniList, Jikan, and Kitsu are currently unavailable. Please try again later.",
        failures,
      );
    }

    return {
      provider: null,
      results: [],
      fallbackUsed: failures.length > 0,
      warning: failures.length
        ? `No matching anime found. ${failures.map((failure) => failure.provider).join(", ")} could not be reached.`
        : null,
    };
  }

  async function details(
    provider: MetadataProvider,
    providerId: string,
    externalIds: ExternalIds = {},
    title?: string,
  ) {
    const orderedProviders: Array<{ provider: MetadataProvider; id: string }> = [
      { provider, id: providerId },
      ...(externalIds.anilistId && provider !== "ANILIST" ? [{ provider: "ANILIST" as const, id: String(externalIds.anilistId) }] : []),
      ...(externalIds.jikanId && provider !== "JIKAN" ? [{ provider: "JIKAN" as const, id: String(externalIds.jikanId) }] : []),
      ...(externalIds.kitsuId && provider !== "KITSU" ? [{ provider: "KITSU" as const, id: externalIds.kitsuId }] : []),
    ];
    const failures: ProviderFailure[] = [];
    const attempted = new Set<string>();
    const attemptedProviders = new Set<MetadataProvider>();

    for (const candidate of orderedProviders) {
      const key = `${candidate.provider}:${candidate.id}`;
      if (attempted.has(key)) continue;
      attempted.add(key);
      attemptedProviders.add(candidate.provider);
      try {
        switch (candidate.provider) {
          case "ANILIST":
            return { media: normalizeAniList(await clients.anilist.details(Number(candidate.id))), fallbackUsed: candidate.provider !== provider };
          case "JIKAN":
            return { media: normalizeJikan(await clients.jikan.details(Number(candidate.id))), fallbackUsed: candidate.provider !== provider };
          case "KITSU":
            return { media: normalizeKitsu(await clients.kitsu.details(candidate.id)), fallbackUsed: candidate.provider !== provider };
        }
      } catch (error) {
        failures.push(providerFailure(candidate.provider, error));
      }
    }

    const searchTitle = title?.trim();
    const expectedTitle = searchTitle ? titleKey(searchTitle) : "";
    if (searchTitle && expectedTitle) {
      const fallbacks = (["ANILIST", "JIKAN", "KITSU"] as const)
        .filter((candidate) => !attemptedProviders.has(candidate));
      for (const candidate of fallbacks) {
        try {
          let matches: AnimeMetadata[];
          switch (candidate) {
            case "ANILIST":
              matches = (await clients.anilist.search(searchTitle, "all")).map(normalizeAniList);
              break;
            case "JIKAN":
              matches = (await clients.jikan.search(searchTitle, "all")).map(normalizeJikan);
              break;
            case "KITSU":
              matches = (await clients.kitsu.search(searchTitle, "all")).map(normalizeKitsu);
              break;
            default:
              throw new Error(`Unsupported metadata provider: ${candidate}`);
          }
          const match = matches.find((item) =>
            [item.title, item.romajiTitle, item.japaneseTitle, item.alternativeTitle]
              .some((value) => value && titleKey(value) === expectedTitle),
          );
          if (match) return { media: match, fallbackUsed: true };
        } catch (error) {
          failures.push(providerFailure(candidate, error));
        }
      }
    }

    throw new AnimeMetadataError(
      "Anime details could not be loaded from any available provider.",
      failures,
    );
  }

  return { search, details };
}

const service = createAnimeMetadataService();

export const searchAnimeMetadata = service.search;
export const getAnimeMetadataDetails = service.details;
