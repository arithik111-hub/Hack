import assert from "node:assert/strict";
import test from "node:test";
import { AniListApiError, createAniListClient, getAniListCover, isAniListImageUrl } from "../src/lib/anilist/client";

const media = {
  id: 42,
  idMal: 1001,
  title: { english: "Eclipse Zero", romaji: "Eclipse Zero", native: null },
  description: "An original story.",
  coverImage: { extraLarge: "https://s4.anilist.co/file/cover.jpg", large: null },
  bannerImage: null,
  season: "FALL",
  seasonYear: 2026,
  averageScore: 80,
  popularity: 12345,
  status: "FINISHED",
  episodes: 12,
  duration: 24,
  format: "TV",
  source: "ORIGINAL",
  genres: ["Action", "Sci-Fi"],
  studios: { nodes: [{ name: "Example Studio" }] },
  externalLinks: [{ site: "Official Site", url: "https://example.test/", type: "INFO" }],
};

test("AniList search sends the documented GraphQL POST and caches results", async () => {
  let callCount = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    callCount += 1;
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
    assert.equal(new Headers(init?.headers).get("X-API-Key"), null);
    const body = JSON.parse(String(init?.body)) as { query: string; variables: { search: string } };
    assert.match(body.query, /Page\(page: 1, perPage: 10\)/);
    assert.match(body.query, /studios\(isMain: true\) \{ nodes \{ name \} \}/);
    assert.doesNotMatch(body.query, /nodes \{ name isMain \}/);
    assert.equal(body.variables.search, "Eclipse Zero");
    return new Response(JSON.stringify({ data: { Page: { media: [media] } } }), { status: 200 });
  };
  const client = createAniListClient({ fetcher, now: () => 1_000 });

  const first = await client.search("Eclipse Zero");
  const second = await client.search("Eclipse Zero");

  assert.equal(first[0].id, 42);
  assert.equal(second[0].title?.english, "Eclipse Zero");
  assert.equal(callCount, 1);
});

test("AniList applies status and format catalogue filters", async () => {
  const fetcher: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      variables: { search?: string; status?: string; format?: string };
    };
    assert.equal("search" in body.variables, false);
    assert.equal(body.variables.status, "RELEASING");
    assert.equal("format" in body.variables, false);
    return new Response(JSON.stringify({ data: { Page: { media: [media] } } }), { status: 200 });
  };

  const results = await createAniListClient({ fetcher }).search("", "airing");
  assert.equal(results[0].idMal, 1001);
});

test("AniList details use an integer media ID and validate the response", async () => {
  const fetcher: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: { id: number } };
    assert.match(body.query, /Media\(id: \$id, type: ANIME\)/);
    assert.equal(body.variables.id, 42);
    return new Response(JSON.stringify({ data: { Media: media } }), { status: 200 });
  };
  const details = await createAniListClient({ fetcher }).details(42);

  assert.equal(details.id, 42);
  assert.equal(getAniListCover(details), "https://s4.anilist.co/file/cover.jpg");
});

test("AniList propagates retry hints and rejects untrusted artwork hosts", async () => {
  const fetcher: typeof fetch = async () => new Response(
    JSON.stringify({ errors: [{ message: "Too many requests" }] }),
    { status: 429, headers: { "Retry-After": "30" } },
  );
  const client = createAniListClient({ fetcher });

  await assert.rejects(client.search("Eclipse Zero"), (error: unknown) =>
    error instanceof AniListApiError && error.status === 429 && error.retryAfter === "30",
  );
  assert.equal(isAniListImageUrl("https://s4.anilist.co/file/cover.jpg"), true);
  assert.equal(isAniListImageUrl("https://127.0.0.1/cover.jpg"), false);
  assert.equal(isAniListImageUrl("http://s4.anilist.co/file/cover.jpg"), false);
  assert.equal(isAniListImageUrl("https://user@s4.anilist.co/file/cover.jpg"), false);
  assert.equal(isAniListImageUrl("https://s4.anilist.co:444/file/cover.jpg"), false);
});
