import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectVideoType,
  MediaInputError,
  validateSourceUrl,
} from "../src/lib/media/source-validation";
import {
  decryptSourceUrl,
  encryptSourceUrl,
} from "../src/lib/media/source-crypto";
import { createMediaJobDedupeKey } from "../src/lib/media/job-dedupe";

const allowedHosts = new Set(["media.example.test"]);

test("accepts HTTPS sources only from the exact allowlisted host", async () => {
  const result = await validateSourceUrl(
    "https://media.example.test/videos/episode.mp4?token=private",
    allowedHosts,
    async () => ["93.184.216.34"],
  );
  assert.equal(result.url.hostname, "media.example.test");
  assert.deepEqual(result.addresses, ["93.184.216.34"]);
});

test("rejects unapproved hosts before resolving them", async () => {
  let resolved = false;
  await assert.rejects(
    validateSourceUrl("https://other.example.test/video.mp4", allowedHosts, async () => {
      resolved = true;
      return ["93.184.216.34"];
    }),
    MediaInputError,
  );
  assert.equal(resolved, false);
});

test("rejects insecure, credentialed, custom-port, and IP-literal URLs", async () => {
  for (const url of [
    "http://media.example.test/video.mp4",
    "https://user:password@media.example.test/video.mp4",
    "https://media.example.test:8443/video.mp4",
    "https://127.0.0.1/video.mp4",
  ]) {
    await assert.rejects(
      validateSourceUrl(url, allowedHosts, async () => ["93.184.216.34"]),
      MediaInputError,
    );
  }
});

test("rejects private or mixed public/private DNS answers", async () => {
  for (const addresses of [
    ["127.0.0.1"],
    ["10.0.0.5"],
    ["::1"],
    ["93.184.216.34", "192.168.1.1"],
  ]) {
    await assert.rejects(
      validateSourceUrl("https://media.example.test/video.mp4", allowedHosts, async () => addresses),
      MediaInputError,
    );
  }
});

test("accepts supported video signatures and rejects playlists and HTML", () => {
  const mp4 = Buffer.from([
    0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93]);
  assert.equal(detectVideoType(mp4, "video/mp4").sourceType, "MP4");
  assert.equal(detectVideoType(webm, "video/webm").mimeType, "video/webm");
  assert.throws(
    () => detectVideoType(Buffer.from("#EXTM3U"), "application/vnd.apple.mpegurl"),
    MediaInputError,
  );
  assert.throws(
    () => detectVideoType(Buffer.from("<html>error</html>"), "text/html"),
    MediaInputError,
  );
});

test("encrypts source URLs at rest and rejects modified ciphertext", () => {
  const previous = process.env.MEDIA_JOB_ENCRYPTION_KEY;
  process.env.MEDIA_JOB_ENCRYPTION_KEY = "a".repeat(64);
  try {
    const source = "https://media.example.test/video.mp4?signature=secret";
    const encrypted = encryptSourceUrl(source);
    assert.notEqual(encrypted, source);
    assert.equal(decryptSourceUrl(encrypted), source);
    assert.throws(() => decryptSourceUrl(`${encrypted.slice(0, -1)}x`));
  } finally {
    if (previous === undefined) delete process.env.MEDIA_JOB_ENCRYPTION_KEY;
    else process.env.MEDIA_JOB_ENCRYPTION_KEY = previous;
  }
});

test("deduplicates the same episode, language, and source", () => {
  const first = createMediaJobDedupeKey(
    "episode-1",
    "JA",
    "https://media.example.test/video.mp4?token=one",
  );
  const duplicate = createMediaJobDedupeKey(
    "episode-1",
    "ja",
    "https://media.example.test/video.mp4?token=one",
  );
  const otherEpisode = createMediaJobDedupeKey(
    "episode-2",
    "ja",
    "https://media.example.test/video.mp4?token=one",
  );

  assert.equal(first, duplicate);
  assert.notEqual(first, otherEpisode);
});
