import assert from "node:assert/strict";
import test from "node:test";
import { matchAnimeDuplicates, type ExistingAnime } from "../src/lib/anime-metadata-db";
import type { AnimeMetadata } from "../src/lib/anime-metadata";

const candidate: AnimeMetadata = {
  provider: "KITSU",
  providerId: "1555",
  anilistId: 20,
  jikanId: 20,
  kitsuId: "1555",
  title: "Naruto",
  romajiTitle: "Naruto",
  japaneseTitle: "ナルト",
  alternativeTitle: null,
  description: "A story about ninjas.",
  poster: null,
  banner: null,
  releaseYear: 2002,
  season: null,
  durationMinutes: 23,
  sourceMaterial: null,
  officialWebsite: null,
  rating: 7.9,
  popularity: 100,
  status: "COMPLETED",
  type: "TV",
  totalEpisodes: 220,
  studio: "Studio Pierrot",
  genres: ["Action"],
};

test("duplicate matching catches cross-provider IDs, case-insensitive titles, and slugs", () => {
  const records: ExistingAnime[] = [
    { id: "anilist-record", title: "Existing Naruto", slug: "existing-naruto", anilistId: 20, jikanId: null, kitsuId: null },
    { id: "title-record", title: "naruto", slug: "naruto-title", anilistId: null, jikanId: null, kitsuId: null },
    { id: "slug-record", title: "Different Title", slug: "naruto", anilistId: null, jikanId: null, kitsuId: null },
  ];

  assert.equal(matchAnimeDuplicates([candidate], records)[0]?.id, "anilist-record");
  assert.equal(matchAnimeDuplicates([candidate], records.slice(1, 2))[0]?.id, "title-record");
  assert.equal(matchAnimeDuplicates([candidate], records.slice(2), { slug: "naruto" })[0]?.id, "slug-record");
  assert.equal(matchAnimeDuplicates([candidate], records, { excludeId: "anilist-record" })[0]?.id, "title-record");
});
