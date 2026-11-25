export type RasterImage = {
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/avif";
  extension: "png" | "jpg" | "webp" | "avif";
};

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function detectRasterImage(bytes: Uint8Array): RasterImage | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(readAscii(bytes, 8, 12))
  ) {
    return { contentType: "image/avif", extension: "avif" };
  }
  return null;
}
