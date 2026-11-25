import assert from "node:assert/strict";
import test from "node:test";
import {
  createKitsuClient,
  getKitsuBanner,
  getKitsuCover,
  isKitsuImageUrl,
  KitsuApiError,
} from "../src/lib/kitsu/client";

const anime = {
  id: "1555",
  type: "anime",
  attributes: {
    canonicalTitle: "Naruto: Shippuuden",
    titles: { en: "Naruto: Shippuden", en_jp: "Naruto: Shippuuden", ja_jp: "ナルト- 疾風伝" },
    abbreviatedTitles: ["Naruto Hurricane Chronicles"],
    synopsis: "A story about ninjas.",
    startDate: "2007-02-15",
    seasonYear: 2007,
    episodeCount: 500,
    episodeLength: 23,
    averageRating: "84.07",
    userCount: 215833,
    popularityRank: 28,
    subtype: "TV",
    status: "finished",
    posterImage: {
      original: "https://media.kitsu.app/anime/poster_images/1555/original.jpg",
      large: "https://media.kitsu.app/anime/poster_images/1555/large.jpg",
    },
    coverImage: {
      original: "https://media.kitsu.app/anime/cover_images/1555/original.jpg",
    },
  },
  relationships: {
    genres: { data: [{ type: "genres", id: "1" }] },
    productions: { data: [{ type: "mediaProductions", id: "4203" }] },
    mappings: {
      data: [
        { type: "mappings", id: "2342" },
        { type: "mappings", id: "254630" },
      ],
    },
  },
};

const included = [
  { id: "1", type: "genres", attributes: { name: "Action" } },
  {
    id: "4203",
    type: "mediaProductions",
    attributes: { role: "studio" },
    relationships: { company: { data: { type: "producers", id: "25" } } },
  },
  { id: "25", type: "producers", attributes: { name: "Pierrot" } },
  { id: "2342", type: "mappings", attributes: { externalSite: "myanimelist/anime", externalId: "1735" } },
  { id: "254630", type: "mappings", attributes: { externalSite: "anilist/anime", externalId: "1735" } },
];

test("Kitsu search includes free-text filters and extracts genres, studios, and external IDs", async () => {
  let callCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    callCount += 1;
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Accept"), "application/vnd.api+json");
    const url = new URL(String(input));
    assert.equal(url.origin, "https://kitsu.io");
    assert.equal(url.pathname, "/api/edge/anime");
    assert.equal(url.searchParams.get("filter[text]"), "Naruto");
    assert.equal(url.searchParams.get("filter[status]"), "current");
    assert.equal(url.searchParams.get("page[limit]"), "10");
    assert.match(url.searchParams.get("include") ?? "", /productions\.company/);
    return new Response(JSON.stringify({ data: [anime], included }), { status: 200 });
  };
  const client = createKitsuClient({ fetcher, now: () => 1_000 });

  const first = await client.search("Naruto", "airing");
  const second = await client.search("Naruto", "airing");

  assert.equal(first[0].id, "1555");
  assert.deepEqual(first[0].genres, ["Action"]);
  assert.deepEqual(first[0].studios, ["Pierrot"]);
  assert.equal(first[0].jikanId, 1735);
  assert.equal(first[0].anilistId, 1735);
  assert.equal(second[0].canonicalTitle, "Naruto: Shippuuden");
  assert.equal(callCount, 1);
});

test("Kitsu details parse JSON:API records and return trusted cover artwork", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/edge/anime/1555");
    return new Response(JSON.stringify({ data: anime, included }), { status: 200 });
  };
  const details = await createKitsuClient({ fetcher }).details("1555");

  assert.equal(details.id, "1555");
  assert.equal(getKitsuCover(details), "https://media.kitsu.app/anime/poster_images/1555/original.jpg");
  assert.equal(getKitsuBanner(details), "https://media.kitsu.app/anime/cover_images/1555/original.jpg");
});

test("Kitsu propagates retry hints and rejects untrusted image hosts", async () => {
  const fetcher: typeof fetch = async () => new Response(
    JSON.stringify({ errors: [{ title: "Rate limited" }] }),
    { status: 429, headers: { "Retry-After": "4" } },
  );
  const client = createKitsuClient({ fetcher });

  await assert.rejects(client.details("1555"), (error: unknown) =>
    error instanceof KitsuApiError && error.status === 429 && error.retryAfter === "4",
  );
  assert.equal(isKitsuImageUrl("https://media.kitsu.app/anime/poster.jpg"), true);
  assert.equal(isKitsuImageUrl("https://media.kitsu.io/anime/poster.jpg"), true);
  assert.equal(isKitsuImageUrl("https://evil.example/poster.jpg"), false);
  assert.equal(isKitsuImageUrl("http://media.kitsu.app/poster.jpg"), false);
  assert.equal(isKitsuImageUrl("https://user@media.kitsu.app/poster.jpg"), false);
});
