import type { AnimeMetadata } from "@/lib/anime-metadata";

export type ExistingAnime = {
  id: string;
  title: string;
  slug: string;
  anilistId: number | null;
  jikanId: number | null;
  kitsuId: string | null;
};

function titleCandidates(metadata: AnimeMetadata) {
  return [
    metadata.title,
    metadata.romajiTitle,
    metadata.japaneseTitle,
    ...(metadata.alternativeTitle?.split(" · ") ?? []),
  ].filter((title): title is string => Boolean(title?.trim()));
}

export function matchAnimeDuplicates(
  metadataItems: AnimeMetadata[],
  records: ExistingAnime[],
  options: { slug?: string; excludeId?: string } = {},
) {
  return metadataItems.map((metadata) => {
    const titlesForMetadata = new Set(titleCandidates(metadata).map((title) => title.toLowerCase()));
    return records.find((record) =>
      record.id !== options.excludeId &&
      (
        (metadata.anilistId !== null && record.anilistId === metadata.anilistId) ||
        (metadata.jikanId !== null && record.jikanId === metadata.jikanId) ||
        (metadata.kitsuId !== null && record.kitsuId === metadata.kitsuId) ||
        titlesForMetadata.has(record.title.toLowerCase()) ||
        (options.slug !== undefined && record.slug === options.slug)
      ),
    ) ?? null;
  });
}

export async function findAnimeDuplicates(
  metadataItems: AnimeMetadata[],
  options: { slug?: string; excludeId?: string } = {},
) {
  const anilistIds = [...new Set(metadataItems.flatMap((item) => item.anilistId ? [item.anilistId] : []))];
  const jikanIds = [...new Set(metadataItems.flatMap((item) => item.jikanId ? [item.jikanId] : []))];
  const kitsuIds = [...new Set(metadataItems.flatMap((item) => item.kitsuId ? [item.kitsuId] : []))];
  const titles = [...new Set(metadataItems.flatMap(titleCandidates))];
  const conditions = [
    ...(anilistIds.length ? [{ anilistId: { in: anilistIds } }] : []),
    ...(jikanIds.length ? [{ jikanId: { in: jikanIds } }] : []),
    ...(kitsuIds.length ? [{ kitsuId: { in: kitsuIds } }] : []),
    ...(titles.length ? [{ title: { in: titles, mode: "insensitive" as const } }] : []),
    ...(options.slug ? [{ slug: options.slug }] : []),
  ];

  if (!conditions.length) return metadataItems.map(() => null);

  const { getDatabase } = await import("@/lib/db");
  const records = await getDatabase().anime.findMany({
    where: {
      OR: conditions,
      ...(options.excludeId ? { NOT: { id: options.excludeId } } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      anilistId: true,
      jikanId: true,
      kitsuId: true,
    },
  });

  return matchAnimeDuplicates(metadataItems, records, options);
}
