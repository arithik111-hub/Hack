import assert from "node:assert/strict";
import test from "node:test";
import { detectRasterImage } from "../src/lib/storage/image-validation";

test("cover upload accepts supported raster image signatures", () => {
  assert.deepEqual(
    detectRasterImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { contentType: "image/png", extension: "png" },
  );
  assert.deepEqual(
    detectRasterImage(Uint8Array.from([0xff, 0xd8, 0xff])),
    { contentType: "image/jpeg", extension: "jpg" },
  );
  assert.deepEqual(
    detectRasterImage(new TextEncoder().encode("RIFF0000WEBP")),
    { contentType: "image/webp", extension: "webp" },
  );
  assert.deepEqual(
    detectRasterImage(new TextEncoder().encode("0000ftypavif")),
    { contentType: "image/avif", extension: "avif" },
  );
});

test("cover upload rejects non-image and incomplete signatures", () => {
  assert.equal(detectRasterImage(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(detectRasterImage(Uint8Array.from([0x89, 0x50, 0x4e])), null);
});
