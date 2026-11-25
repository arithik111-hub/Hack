import { z } from "zod";
import type { AnimeCatalogueFilter } from "@/lib/anilist/client";

const API_URL = "https://kitsu.io/api/edge";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SECOND_WINDOW_MS = 1000;
const MINUTE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_SECOND = 5;
const MAX_REQUESTS_PER_MINUTE = 60;
const INCLUDE = "genres,productions.company,mappings";

const imageSetSchema = z.object({
  original: z.string().url().nullable().optional(),
  large: z.string().url().nullable().optional(),
  medium: z.string().url().nullable().optional(),
  small: z.string().url().nullable().optional(),
});

const linkDataSchema = z.object({
  id: z.string(),
  type: z.string(),
});

const animeResourceSchema = z.object({
  id: z.string().regex(/^\d+$/),
  type: z.literal("anime"),
  attributes: z.object({
    canonicalTitle: z.string().nullable().optional(),
    titles: z.object({
      en: z.string().nullable().optional(),
      en_jp: z.string().nullable().optional(),
      en_us: z.string().nullable().optional(),
      ja_jp: z.string().nullable().optional(),
    }).passthrough().nullable().optional(),
    abbreviatedTitles: z.array(z.string()).optional(),
    synopsis: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    seasonYear: z.number().int().nullable().optional(),
    episodeCount: z.number().int().nonnegative().nullable().optional(),
    episodeLength: z.number().int().positive().nullable().optional(),
    averageRating: z.union([z.string(), z.number()]).nullable().optional(),
    userCount: z.number().int().nonnegative().nullable().optional(),
    popularityRank: z.number().int().positive().nullable().optional(),
    subtype: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    posterImage: imageSetSchema.nullable().optional(),
    coverImage: imageSetSchema.nullable().optional(),
  }),
  relationships: z.object({
    genres: z.object({ data: z.array(linkDataSchema).optional() }).optional(),
    productions: z.object({ data: z.array(linkDataSchema).optional() }).optional(),
    mappings: z.object({ data: z.array(linkDataSchema).optional() }).optional(),
  }).optional(),
});

const includedResourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  attributes: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    externalSite: z.string().optional(),
    externalId: z.string().optional(),
  }).optional(),
  relationships: z.object({
    company: z.object({ data: linkDataSchema.nullable().optional() }).optional(),
  }).optional(),
});

const responseSchema = z.object({
  data: z.union([animeResourceSchema, z.array(animeResourceSchema)]),
  included: z.array(includedResourceSchema).optional(),
});

export type KitsuAnime = {
  id: string;
  canonicalTitle: string | null;
  titles: {
    en?: string | null;
    en_jp?: string | null;
    en_us?: string | null;
    ja_jp?: string | null;
  } | null;
  abbreviatedTitles: string[];
  synopsis: string | null;
  description: string | null;
  startDate: string | null;
  seasonYear: number | null;
  episodeCount: number | null;
  episodeLength: number | null;
  averageRating: string | number | null;
  userCount: number | null;
  popularityRank: number | null;
  subtype: string | null;
  status: string | null;
  posterImage: z.infer<typeof imageSetSchema> | null;
  coverImage: z.infer<typeof imageSetSchema> | null;
  genres: string[];
  studios: string[];
  anilistId: number | null;
  jikanId: number | null;
};

export class KitsuApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "KitsuApiError";
  }
}

function relatedNames(
  links: Array<{ id: string; type: string }> | undefined,
  included: z.infer<typeof includedResourceSchema>[],
) {
  const resources = new Map(included.map((entry) => [`${entry.type}:${entry.id}`, entry]));
  return (links ?? [])
    .map((link) => resources.get(`${link.type}:${link.id}`)?.attributes?.name)
    .filter((name): name is string => Boolean(name));
}

function studiosFor(
  links: Array<{ id: string; type: string }> | undefined,
  included: z.infer<typeof includedResourceSchema>[],
) {
  const resources = new Map(included.map((entry) => [`${entry.type}:${entry.id}`, entry]));
  const companyIds = (links ?? [])
    .map((link) => resources.get(`${link.type}:${link.id}`))
    .filter((production) => production?.type === "mediaProductions" && production.attributes?.role === "studio")
    .map((production) => production?.relationships?.company?.data)
    .filter((company): company is { id: string; type: string } => Boolean(company));
  return relatedNames(companyIds, included);
}

function linkedId(
  links: Array<{ id: string; type: string }> | undefined,
  included: z.infer<typeof includedResourceSchema>[],
  externalSite: string,
) {
  const resources = new Map(included.map((entry) => [`${entry.type}:${entry.id}`, entry]));
  for (const link of links ?? []) {
    const mapping = resources.get(`${link.type}:${link.id}`);
    if (mapping?.attributes?.externalSite !== externalSite) continue;
    const id = Number(mapping.attributes.externalId);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

function parseAnime(resource: z.infer<typeof animeResourceSchema>, included: z.infer<typeof includedResourceSchema>[]): KitsuAnime {
  const relationships = resource.relationships;
  return {
    id: resource.id,
    canonicalTitle: resource.attributes.canonicalTitle ?? null,
    titles: resource.attributes.titles ?? null,
    abbreviatedTitles: resource.attributes.abbreviatedTitles ?? [],
    synopsis: resource.attributes.synopsis ?? null,
    description: resource.attributes.description ?? null,
    startDate: resource.attributes.startDate ?? null,
    seasonYear: resource.attributes.seasonYear ?? null,
    episodeCount: resource.attributes.episodeCount ?? null,
    episodeLength: resource.attributes.episodeLength ?? null,
    averageRating: resource.attributes.averageRating ?? null,
    userCount: resource.attributes.userCount ?? null,
    popularityRank: resource.attributes.popularityRank ?? null,
    subtype: resource.attributes.subtype ?? null,
    status: resource.attributes.status ?? null,
    posterImage: resource.attributes.posterImage ?? null,
    coverImage: resource.attributes.coverImage ?? null,
    genres: relatedNames(relationships?.genres?.data, included),
    studios: studiosFor(relationships?.productions?.data, included),
    anilistId: linkedId(relationships?.mappings?.data, included, "anilist/anime"),
    jikanId: linkedId(relationships?.mappings?.data, included, "myanimelist/anime"),
  };
}

const filterOptions: Record<AnimeCatalogueFilter, {
  status?: string;
  subtype?: string;
  sort?: string;
}> = {
  all: {},
  popular: { sort: "-userCount" },
  recent: { sort: "-startDate" },
  airing: { status: "current", sort: "-userCount" },
  completed: { status: "finished", sort: "-userCount" },
  upcoming: { status: "upcoming", sort: "-userCount" },
  movies: { subtype: "movie", sort: "-userCount" },
  tv: { subtype: "TV", sort: "-userCount" },
};

export function createKitsuClient(options: {
  fetcher?: typeof fetch;
  now?: () => number;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; value: unknown }>();
  const requestTimes: number[] = [];

  function checkRateLimit() {
    const currentTime = now();
    while (requestTimes.length && requestTimes[0] <= currentTime - MINUTE_WINDOW_MS) {
      requestTimes.shift();
    }

    const requestsThisSecond = requestTimes.filter(
      (timestamp) => timestamp > currentTime - SECOND_WINDOW_MS,
    );
    if (requestsThisSecond.length >= MAX_REQUESTS_PER_SECOND) {
      const retryAfter = Math.max(
        1,
        Math.ceil((requestsThisSecond[0] + SECOND_WINDOW_MS - currentTime) / 1000),
      );
      throw new KitsuApiError("Kitsu request limit reached. Wait before trying again.", 429, String(retryAfter));
    }
    if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
      const retryAfter = Math.max(
        1,
        Math.ceil((requestTimes[0] + MINUTE_WINDOW_MS - currentTime) / 1000),
      );
      throw new KitsuApiError("Kitsu request limit reached. Wait before trying again.", 429, String(retryAfter));
    }

    requestTimes.push(currentTime);
  }

  async function request(path: string, key: string) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;

    checkRateLimit();

    let response: Response;
    try {
      response = await fetcher(`${API_URL}${path}`, {
        method: "GET",
        headers: { Accept: "application/vnd.api+json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new KitsuApiError("Kitsu could not be reached. Please try again.", 502);
    }

    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const errorBody = z.object({
        errors: z.array(z.object({ detail: z.string().optional(), title: z.string().optional() })).optional(),
      }).safeParse(body);
      throw new KitsuApiError(
        errorBody.success
          ? errorBody.data.errors?.[0]?.detail ?? errorBody.data.errors?.[0]?.title ?? "Kitsu returned an error."
          : "Kitsu returned an error.",
        response.status,
        response.headers.get("Retry-After"),
      );
    }
    if (body === null) throw new KitsuApiError("Kitsu returned an invalid response.", 502);

    for (const [cachedKey, entry] of cache) {
      if (entry.expiresAt <= now()) cache.delete(cachedKey);
    }
    if (cache.size >= 500) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { expiresAt: now() + CACHE_TTL_MS, value: body });
    return body;
  }

  function parse(body: unknown, expectList: boolean) {
    const result = responseSchema.safeParse(body);
    if (!result.success) throw new KitsuApiError("Kitsu returned unexpected anime metadata.", 502);
    const resources = Array.isArray(result.data.data) ? result.data.data : [result.data.data];
    if (!expectList && resources.length !== 1) {
      throw new KitsuApiError("Kitsu returned unexpected anime details.", 502);
    }
    const included = result.data.included ?? [];
    return resources.map((resource) => parseAnime(resource, included));
  }

  return {
    async search(keyword: string, filter: AnimeCatalogueFilter = "all") {
      const normalizedKeyword = keyword.trim();
      const options = filterOptions[filter];
      const params = new URLSearchParams({
        "page[limit]": "10",
        include: INCLUDE,
      });
      if (normalizedKeyword) params.set("filter[text]", normalizedKeyword);
      if (options.status) params.set("filter[status]", options.status);
      if (options.subtype) params.set("filter[subtype]", options.subtype);
      if (options.sort) params.set("sort", options.sort);

      const path = `/anime?${params}`;
      const body = await request(path, `search:${filter}:${normalizedKeyword.toLowerCase()}`);
      return parse(body, true);
    },
    async details(id: string) {
      if (!/^\d+$/.test(id)) throw new KitsuApiError("Invalid Kitsu anime ID.", 400);
      const body = await request(`/anime/${encodeURIComponent(id)}?include=${encodeURIComponent(INCLUDE)}`, `details:${id}`);
      const [anime] = parse(body, false);
      return anime;
    },
  };
}

const client = createKitsuClient();

export const searchKitsuAnime = client.search;
export const getKitsuAnime = client.details;

export function isKitsuImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      ["media.kitsu.app", "media.kitsu.io"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getKitsuCover(anime: KitsuAnime) {
  return [
    anime.posterImage?.original,
    anime.posterImage?.large,
    anime.posterImage?.medium,
  ].find((cover): cover is string => Boolean(cover && isKitsuImageUrl(cover))) ?? null;
}

export function getKitsuBanner(anime: KitsuAnime) {
  return [
    anime.coverImage?.original,
    anime.coverImage?.large,
    getKitsuCover(anime),
  ].find((cover): cover is string => Boolean(cover && isKitsuImageUrl(cover))) ?? null;
}
