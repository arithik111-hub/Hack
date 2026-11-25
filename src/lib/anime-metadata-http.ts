import { AnimeMetadataError } from "@/lib/anime-metadata";

export function animeMetadataErrorResponse(error: unknown, context: string, message: string) {
  if (error instanceof AnimeMetadataError) {
    const headers = new Headers();
    if (error.retryAfter) headers.set("Retry-After", error.retryAfter);
    return Response.json({ error: error.message }, { status: error.status, headers });
  }

  console.error(context, error);
  return Response.json({ error: message }, { status: 500 });
}
