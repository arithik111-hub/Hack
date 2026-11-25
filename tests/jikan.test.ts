import assert from "node:assert/strict";
import test from "node:test";
import { createJikanClient, getJikanCover, isJikanImageUrl, JikanApiError } from "../src/lib/jikan/client";

const anime = {
  mal_id: 22319,
  title: "Tokyo Ghoul",
  title_english: "Tokyo Ghoul",
  title_japanese: "東京喰種トーキョーグール",
  title_synonyms: [],
  synopsis: "A student encounters ghouls living among humans.",
  images: {
    jpg: {
      image_url: "https://cdn.myanimelist.net/images/anime/5/64449.jpg",
      large_image_url: "https://cdn.myanimelist.net/images/anime/5/64449l.jpg",
    },
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
  genres: [{ name: "Action" }, { name: "Horror" }],
  studios: [{ name: "Pierrot" }],
};

test("Jikan search uses GET and caches results for 24 hours", async () => {
  let callCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    callCount += 1;
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Accept"), "application/json");
    assert.equal(init?.body, undefined);
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.jikan.moe");
    assert.equal(url.pathname, "/v4/anime");
    assert.equal(url.searchParams.get("q"), "Tokyo Ghoul");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("sfw"), "true");
    return new Response(JSON.stringify({ data: [anime] }), { status: 200 });
  };
  const client = createJikanClient({ fetcher, now: () => 1_000 });

  const first = await client.search("Tokyo Ghoul");
  const second = await client.search("Tokyo Ghoul");

  assert.equal(first[0].mal_id, 22319);
  assert.equal(second[0].title_english, "Tokyo Ghoul");
  assert.equal(callCount, 1);
});

test("Jikan details use the full endpoint and select trusted artwork", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.method, "GET");
    assert.equal(new URL(String(input)).pathname, "/v4/anime/22319/full");
    return new Response(JSON.stringify({ data: anime }), { status: 200 });
  };
  const details = await createJikanClient({ fetcher }).details(22319);

  assert.equal(details.mal_id, 22319);
  assert.equal(getJikanCover(details), "https://cdn.myanimelist.net/images/anime/5/64449l.jpg");
});

test("Jikan errors include retry hints and artwork hosts are restricted", async () => {
  const fetcher: typeof fetch = async () => new Response(
    JSON.stringify({ message: "Too many requests" }),
    { status: 429, headers: { "Retry-After": "2" } },
  );
  const client = createJikanClient({ fetcher });

  await assert.rejects(client.search("Tokyo Ghoul"), (error: unknown) =>
    error instanceof JikanApiError && error.status === 429 && error.retryAfter === "2",
  );
  assert.equal(isJikanImageUrl("https://cdn.myanimelist.net/images/anime/cover.jpg"), true);
  assert.equal(isJikanImageUrl("https://evil.example/cover.jpg"), false);
  assert.equal(isJikanImageUrl("http://cdn.myanimelist.net/cover.jpg"), false);
  assert.equal(isJikanImageUrl("https://user@cdn.myanimelist.net/cover.jpg"), false);
});

test("Jikan client enforces its three-requests-per-second limit", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ data: anime }), { status: 200 });
  const client = createJikanClient({ fetcher, now: () => 1_000 });

  await client.details(1);
  await client.details(2);
  await client.details(3);

  await assert.rejects(client.details(4), (error: unknown) =>
    error instanceof JikanApiError && error.status === 429,
  );
});
