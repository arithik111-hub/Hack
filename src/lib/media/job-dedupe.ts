import { createHash } from "node:crypto";

export function createMediaJobDedupeKey(
  episodeId: string,
  language: string,
  sourceUrl: string,
): string {
  return createHash("sha256")
    .update(`${episodeId}\n${language.trim().toLowerCase()}\n${sourceUrl}`)
    .digest("hex");
}
