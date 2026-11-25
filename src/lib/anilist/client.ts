import { z } from "zod";

const API_URL = "https://graphql.anilist.co";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

export type AnimeCatalogueFilter =
  | "all"
  | "popular"
  | "recent"
  | "airing"
  | "completed"
  | "upcoming"
  | "movies"
  | "tv";

const mediaSchema = z.object({
  id: z.number().int().positive(),
  idMal: z.number().int().positive().nullable().optional(),
  title: z.object({
    english: z.string().nullable().optional(),
    romaji: z.string().nullable().optional(),
    native: z.string().nullable().optional(),
  }).nullable().optional(),
  description: z.string().nullable().optional(),
  coverImage: z.object({
    extraLarge: z.string().url().nullable().optional(),
    large: z.string().url().nullable().optional(),
  }).nullable().optional(),
  bannerImage: z.string().url().nullable().optional(),
  season: z.string().nullable().optional(),
  seasonYear: z.number().int().nullable().optional(),
  averageScore: z.number().min(0).max(100).nullable().optional(),
  popularity: z.number().int().nonnegative().nullable().optional(),
  status: z.string().nullable().optional(),
  episodes: z.number().int().nonnegative().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  format: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
  studios: z.object({
    nodes: z.array(z.object({
      name: z.string(),
    })),
  }).nullable().optional(),
  externalLinks: z.array(z.object({
    site: z.string(),
    url: z.string().url(),
    type: z.string().nullable().optional(),
  })).nullable().optional(),
});

export type AniListMedia = z.infer<typeof mediaSchema>;

const searchQuery = `
  query ($search: String, $status: MediaStatus, $format: MediaFormat, $sort: [MediaSort]) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME, status: $status, format: $format, sort: $sort) {
        id
        idMal
        title { english romaji native }
        description(asHtml: false)
        coverImage { extraLarge large }
        bannerImage
        season
        seasonYear
        averageScore
        popularity
        status
        episodes
        duration
        format
        source
        genres
        studios(isMain: true) { nodes { name } }
        externalLinks { site url type }
      }
    }
  }
`;

const detailQuery = `
  query ($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title { english romaji native }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      season
      seasonYear
      averageScore
      popularity
      status
      episodes
      duration
      format
      source
      genres
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
    }
  }
`;

const filterOptions: Record<
  AnimeCatalogueFilter,
  { status: string | null; format: string | null; sort: string[] }
> = {
  all: { status: null, format: null, sort: ["SEARCH_MATCH"] },
  popular: { status: null, format: null, sort: ["POPULARITY_DESC"] },
  recent: { status: null, format: null, sort: ["START_DATE_DESC"] },
  airing: { status: "RELEASING", format: null, sort: ["POPULARITY_DESC"] },
  completed: { status: "FINISHED", format: null, sort: ["POPULARITY_DESC"] },
  upcoming: { status: "NOT_YET_RELEASED", format: null, sort: ["POPULARITY_DESC"] },
  movies: { status: null, format: "MOVIE", sort: ["POPULARITY_DESC"] },
  tv: { status: null, format: "TV", sort: ["POPULARITY_DESC"] },
};

type GraphQLResponse = {
  data?: { Page?: { media?: unknown[] }; Media?: unknown };
  errors?: Array<{ message?: string }>;
};

export class AniListApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "AniListApiError";
  }
}

export function createAniListClient(options: {
  fetcher?: typeof fetch;
  now?: () => number;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; value: GraphQLResponse }>();
  const requestTimes: number[] = [];

  async function request<T>(
    query: string,
    variables: Record<string, string | number | null | string[]>,
    key: string,
    parse: (body: GraphQLResponse) => T,
  ): Promise<T> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return parse(cached.value);

    while (requestTimes.length && requestTimes[0] <= now() - REQUEST_WINDOW_MS) {
      requestTimes.shift();
    }
    if (requestTimes.length >= MAX_REQUESTS_PER_WINDOW) {
      throw new AniListApiError("AniList request limit reached. Wait a minute before searching again.", 429);
    }
    requestTimes.push(now());

    let response: Response;
    try {
      response = await fetcher(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AniListApiError("AniList could not be reached. Please try again.", 502);
    }

    const body = await response.json().catch(() => null) as GraphQLResponse | null;
    if (!response.ok) {
      throw new AniListApiError(
        body?.errors?.[0]?.message ?? "AniList returned an error.",
        response.status,
        response.headers.get("Retry-After"),
      );
    }
    if (!body) throw new AniListApiError("AniList returned an invalid response.", 502);
    if (body.errors?.length) {
      throw new AniListApiError(body.errors[0]?.message ?? "AniList GraphQL request failed.", 502);
    }

    for (const [cachedKey, entry] of cache) {
      if (entry.expiresAt <= now()) cache.delete(cachedKey);
    }
    if (cache.size >= 500) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { expiresAt: now() + CACHE_TTL_MS, value: body });
    return parse(body);
  }

  return {
    search(keyword: string, filter: AnimeCatalogueFilter = "all") {
      const normalizedKeyword = keyword.trim();
      const options = filterOptions[filter];
      const key = `search:${filter}:${normalizedKeyword.toLowerCase()}`;
      const variables: Record<string, string | number | null | string[]> = {
        sort: normalizedKeyword && filter === "all" ? ["SEARCH_MATCH"] : options.sort,
      };
      if (normalizedKeyword) variables.search = normalizedKeyword;
      if (options.status) variables.status = options.status;
      if (options.format) variables.format = options.format;

      return request(searchQuery, variables, key, (body) => {
        const values = z.array(mediaSchema).safeParse(body.data?.Page?.media);
        if (!values.success) throw new AniListApiError("AniList returned unexpected search results.", 502);
        return values.data;
      });
    },
    details(id: number) {
      const key = `details:${id}`;
      return request(detailQuery, { id }, key, (body) => {
        const value = mediaSchema.safeParse(body.data?.Media);
        if (!value.success) throw new AniListApiError("AniList returned unexpected anime details.", 502);
        return value.data;
      });
    },
  };
}

const client = createAniListClient();

export const searchAniListAnime = client.search;
export const getAniListAnime = client.details;

export function isAniListImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      /^s\d+\.anilist\.co$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function getAniListCover(media: AniListMedia) {
  return [media.coverImage?.extraLarge, media.coverImage?.large]
    .find((cover): cover is string => Boolean(cover && isAniListImageUrl(cover))) ?? null;
}

export function getAniListBanner(media: AniListMedia) {
  const banner = media.bannerImage;
  return banner && isAniListImageUrl(banner) ? banner : getAniListCover(media);
}
