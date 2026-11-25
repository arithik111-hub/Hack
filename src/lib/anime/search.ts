import type { Anime } from "@/data/anime";

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function searchAnime(items: Anime[], query: string) {
  const term = normalize(query);
  if (!term) return items;

  return items.filter((anime) =>
    [anime.title, ...anime.alternativeTitles, ...anime.genres]
      .some((value) => normalize(value).includes(term)),
  );
}
