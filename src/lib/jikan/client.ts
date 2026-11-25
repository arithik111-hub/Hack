import { z } from "zod";
import type { AnimeCatalogueFilter } from "@/lib/anilist/client";

const API_URL = "https://api.jikan.moe/v4";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SECOND_WINDOW_MS = 1000;
const MINUTE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_SECOND = 3;
const MAX_REQUESTS_PER_MINUTE = 60;

const imageSchema = z.object({
  image_url: z.string().url().nullable().optional(),
  small_image_url: z.string().url().nullable().optional(),
  large_image_url: z.string().url().nullable().optional(),
});

const animeSchema = z.object({
  mal_id: z.number().int().positive(),
  title: z.string().min(1),
  title_english: z.string().nullable().optional(),
  title_japanese: z.string().nullable().optional(),
  title_synonyms: z.array(z.string()).optional(),
  synopsis: z.string().nullable().optional(),
  images: z.object({
    jpg: imageSchema.optional(),
    webp: imageSchema.optional(),
  }).optional(),
  year: z.number().int().nullable().optional(),
  season: z.string().nullable().optional(),
  aired: z.object({
    from: z.string().nullable().optional(),
  }).optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  popularity: z.number().int().positive().nullable().optional(),
  status: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  episodes: z.number().int().nonnegative().nullable().optional(),
  source: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  studios: z.array(z.object({ name: z.string() })).optional(),
  external: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
});

export type JikanAnime = z.infer<typeof animeSchema>;

export class JikanApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "JikanApiError";
  }
}

export function createJikanClient(options: {
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
      throw new JikanApiError("Jikan request limit reached. Wait before trying again.", 429, String(retryAfter));
    }
    if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
      const retryAfter = Math.max(
        1,
        Math.ceil((requestTimes[0] + MINUTE_WINDOW_MS - currentTime) / 1000),
      );
      throw new JikanApiError("Jikan request limit reached. Wait before trying again.", 429, String(retryAfter));
    }

    requestTimes.push(currentTime);
  }

  async function request(path: string, key: string): Promise<unknown> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;

    checkRateLimit();

    let response: Response;
    try {
      response = await fetcher(`${API_URL}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new JikanApiError("Jikan could not be reached. Please try again.", 502);
    }

    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const errorBody = z.object({ message: z.string().optional() }).safeParse(body);
      throw new JikanApiError(
        errorBody.success && errorBody.data.message
          ? errorBody.data.message
          : "Jikan returned an error.",
        response.status,
        response.headers.get("Retry-After"),
      );
    }
    if (body === null) throw new JikanApiError("Jikan returned an invalid response.", 502);

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

  return {
    async search(keyword: string, filter: AnimeCatalogueFilter = "all") {
      const normalizedKeyword = keyword.trim();
      const params = new URLSearchParams({ limit: "10", sfw: "true" });
      if (normalizedKeyword) params.set("q", normalizedKeyword);
      switch (filter) {
        case "popular":
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "recent":
          params.set("order_by", "start_date");
          params.set("sort", "desc");
          break;
        case "airing":
          params.set("status", "airing");
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "completed":
          params.set("status", "complete");
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "upcoming":
          params.set("status", "upcoming");
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "movies":
          params.set("type", "movie");
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "tv":
          params.set("type", "tv");
          params.set("order_by", "popularity");
          params.set("sort", "asc");
          break;
        case "all":
          break;
      }
      const body = await request(
        `/anime?${params}`,
        `search:${filter}:${normalizedKeyword.toLowerCase()}`,
      );
      const results = z.object({ data: z.array(animeSchema) }).safeParse(body);
      if (!results.success) throw new JikanApiError("Jikan returned unexpected search results.", 502);
      return results.data.data;
    },
    async details(id: number) {
      const body = await request(`/anime/${id}/full`, `details:${id}`);
      const result = z.object({ data: animeSchema }).safeParse(body);
      if (!result.success) throw new JikanApiError("Jikan returned unexpected anime details.", 502);
      return result.data.data;
    },
  };
}

const client = createJikanClient();

export const searchJikanAnime = client.search;
export const getJikanAnime = client.details;

export function isJikanImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      url.hostname.toLowerCase() === "cdn.myanimelist.net";
  } catch {
    return false;
  }
}

export function getJikanCover(anime: JikanAnime) {
  const images = anime.images;
  return [
    images?.webp?.large_image_url,
    images?.webp?.image_url,
    images?.jpg?.large_image_url,
    images?.jpg?.image_url,
  ].find((cover): cover is string => Boolean(cover && isJikanImageUrl(cover))) ?? null;
}
