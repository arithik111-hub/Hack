import assert from "node:assert/strict";
import test from "node:test";
import {
  AnimeMetadataError,
  createAnimeMetadataService,
  type AnimeMetadataClients,
} from "../src/lib/anime-metadata";
import { AniListApiError, type AniListMedia } from "../src/lib/anilist/client";
import { JikanApiError, type JikanAnime } from "../src/lib/jikan/client";
import { KitsuApiError, type KitsuAnime } from "../src/lib/kitsu/client";

const aniListAnime: AniListMedia = {
  id: 42,
  idMal: 1001,
  title: { english: "Example Anime", romaji: "Example Anime", native: "例アニメ" },
  description: "An original story.",
  coverImage: { extraLarge: "https://s4.anilist.co/file/cover.jpg" },
  bannerImage: null,
  season: "FALL",
  seasonYear: 2026,
  averageScore: 80,
  popularity: 9876,
  status: "RELEASING",
  episodes: 12,
  duration: 24,
  format: "TV",
  source: "ORIGINAL",
  genres: ["Action"],
  studios: { nodes: [{ name: "Example Studio" }] },
  externalLinks: [{ site: "Official Site", url: "https://example.test/", type: "INFO" }],
};

const jikanAnime: JikanAnime = {
  mal_id: 22319,
  title: "Tokyo Ghoul",
  title_english: "Tokyo Ghoul",
  title_japanese: "東京喰種",
  title_synonyms: [],
  synopsis: "A student encounters ghouls.",
  images: {
    jpg: { image_url: "https://cdn.myanimelist.net/images/anime/5/64449.jpg" },
  },
  year: 2014,
  season: "spring",
  score: 7.79,
  popularity: 123,
  status: "Finished Airing",
  duration: "24 min per ep",
  episodes: 12,
  source: "Manga",
  type: "TV",
  genres: [{ name: "Action" }],
  studios: [{ name: "Pierrot" }],
  external: [{ name: "Official Site", url: "https://example.test/" }],
};

const kitsuAnime: KitsuAnime = {
  id: "1555",
  canonicalTitle: "Naruto: Shippuuden",
  titles: { en: "Naruto: Shippuden", en_jp: "Naruto: Shippuuden", ja_jp: "ナルト- 疾風伝" },
  abbreviatedTitles: [],
  synopsis: "A story about ninjas.",
  description: null,
  startDate: "2007-02-15",
  seasonYear: 2007,
  episodeCount: 500,
  episodeLength: 23,
  averageRating: "84.07",
  userCount: 215833,
  popularityRank: 28,
  subtype: "TV",
  status: "finished",
  posterImage: { original: "https://media.kitsu.app/anime/poster_images/1555/original.jpg" },
  coverImage: { original: "https://media.kitsu.app/anime/cover_images/1555/original.jpg" },
  genres: ["Action"],
  studios: ["Pierrot"],
  anilistId: 1735,
  jikanId: 1735,
};

function createClients(overrides: {
  anilistSearch?: AnimeMetadataClients["anilist"]["search"];
  anilistDetails?: AnimeMetadataClients["anilist"]["details"];
  jikanSearch?: AnimeMetadataClients["jikan"]["search"];
  jikanDetails?: AnimeMetadataClients["jikan"]["details"];
  kitsuSearch?: AnimeMetadataClients["kitsu"]["search"];
  kitsuDetails?: AnimeMetadataClients["kitsu"]["details"];
} = {}): AnimeMetadataClients {
  return {
    anilist: {
      search: overrides.anilistSearch ?? (async () => [aniListAnime]),
      details: overrides.anilistDetails ?? (async () => aniListAnime),
    },
    jikan: {
      search: overrides.jikanSearch ?? (async () => [jikanAnime]),
      details: overrides.jikanDetails ?? (async () => jikanAnime),
    },
    kitsu: {
      search: overrides.kitsuSearch ?? (async () => [kitsuAnime]),
      details: overrides.kitsuDetails ?? (async () => kitsuAnime),
    },
  };
}

test("AniList metadata normalizes requested catalogue fields without falling back", async () => {
  const service = createAnimeMetadataService(createClients());
  const result = await service.search("Example", "all");

  assert.equal(result.provider, "ANILIST");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.results[0].anilistId, 42);
  assert.equal(result.results[0].jikanId, 1001);
  assert.equal(result.results[0].durationMinutes, 24);
  assert.equal(result.results[0].sourceMaterial, "ORIGINAL");
  assert.equal(result.results[0].officialWebsite, "https://example.test/");
  assert.equal(result.results[0].rating, 8);
  assert.equal(result.results[0].status, "AIRING");
});

test("Jikan is selected when AniList returns no matches", async () => {
  const service = createAnimeMetadataService(createClients({
    anilistSearch: async () => [],
    jikanSearch: async () => [jikanAnime],
  }));
  const result = await service.search("Tokyo Ghoul", "all");

  assert.equal(result.provider, "JIKAN");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.results[0].jikanId, 22319);
  assert.equal(result.results[0].durationMinutes, 24);
  assert.equal(result.results[0].sourceMaterial, "Manga");
  assert.equal(result.results[0].rating, 7.79);
});

test("AniList failure falls back to Jikan, then Kitsu when Jikan is empty", async () => {
  const service = createAnimeMetadataService(createClients({
    anilistSearch: async () => { throw new AniListApiError("Unavailable", 502); },
    jikanSearch: async () => [],
  }));
  const result = await service.search("Naruto", "all");

  assert.equal(result.provider, "KITSU");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.results[0].kitsuId, "1555");
  assert.equal(result.results[0].anilistId, 1735);
  assert.equal(result.results[0].jikanId, 1735);
  assert.equal(result.results[0].studio, "Pierrot");
  assert.equal(result.results[0].season, "WINTER");
  assert.equal(result.results[0].rating, 8.407);
});

test("detail lookup uses linked provider IDs after the selected provider fails", async () => {
  const service = createAnimeMetadataService(createClients({
    anilistDetails: async () => { throw new AniListApiError("Unavailable", 503); },
    jikanDetails: async () => jikanAnime,
  }));
  const result = await service.details("ANILIST", "42", { jikanId: 22319 });

  assert.equal(result.fallbackUsed, true);
  assert.equal(result.media.provider, "JIKAN");
  assert.equal(result.media.jikanId, 22319);
});

test("detail lookup can fall back to an exact-title search on another provider", async () => {
  const service = createAnimeMetadataService(createClients({
    anilistSearch: async () => [],
    jikanDetails: async () => { throw new JikanApiError("Unavailable", 502); },
    kitsuSearch: async () => [kitsuAnime],
  }));
  const result = await service.details("JIKAN", "22319", {}, "Naruto: Shippuuden");

  assert.equal(result.fallbackUsed, true);
  assert.equal(result.media.provider, "KITSU");
  assert.equal(result.media.kitsuId, "1555");
});

test("metadata search reports provider outage instead of returning empty success", async () => {
  const service = createAnimeMetadataService(createClients({
    anilistSearch: async () => { throw new AniListApiError("Unavailable", 502); },
    jikanSearch: async () => { throw new JikanApiError("Unavailable", 502); },
    kitsuSearch: async () => { throw new KitsuApiError("Unavailable", 502); },
  }));

  await assert.rejects(service.search("Naruto", "all"), AnimeMetadataError);
});
