import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { findAnimeDuplicates } from "@/lib/anime-metadata-db";
import { animeMetadataErrorResponse } from "@/lib/anime-metadata-http";
import {
  getAnimeMetadataDetails,
  sanitizeAnimeDescription,
  type MetadataProvider,
} from "@/lib/anime-metadata";
import { getDatabase } from "@/lib/db";

const requestSchema = z.object({ animeId: z.string().cuid() });

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A valid anime ID is required." }, { status: 400 });

  try {
    const db = getDatabase();
    const anime = await db.anime.findUnique({ where: { id: parsed.data.animeId } });
    if (!anime) return Response.json({ error: "Anime not found." }, { status: 404 });

    const provider: MetadataProvider | null =
      anime.metadataSource === "ANILIST" || anime.anilistId
        ? "ANILIST"
        : anime.metadataSource === "JIKAN" || anime.jikanId
          ? "JIKAN"
          : anime.metadataSource === "KITSU" || anime.kitsuId
            ? "KITSU"
            : null;
    const providerId = provider === "ANILIST"
      ? anime.anilistId?.toString()
      : provider === "JIKAN"
        ? anime.jikanId?.toString()
        : provider === "KITSU"
          ? anime.kitsuId ?? undefined
          : undefined;
    if (!provider || !providerId) {
      return Response.json({ error: "This anime has no external provider ID to synchronize." }, { status: 400 });
    }

    const external = await getAnimeMetadataDetails(provider, providerId, {
      anilistId: anime.anilistId,
      jikanId: anime.jikanId,
      kitsuId: anime.kitsuId,
    }, anime.title);
    const metadata = external.media;
    const [duplicate] = await findAnimeDuplicates([metadata], { excludeId: anime.id });
    if (duplicate) {
      return Response.json({
        error: `Metadata now matches another anime record: ${duplicate.title}.`,
        duplicate,
      }, { status: 409 });
    }

    const genreNames = [...new Map(metadata.genres.map((name) => [name.toLowerCase(), name])).values()];
    const updated = await db.$transaction(async (tx) => {
      if (genreNames.length) {
        await tx.animeGenre.deleteMany({ where: { animeId: anime.id } });
        for (const name of genreNames) {
          const slug = slugify(name);
          if (!slug) throw new Error(`The genre "${name}" cannot be converted to a catalogue slug.`);
          const genre = await tx.genre.upsert({
            where: { name },
            update: {},
            create: { name, slug },
            select: { id: true },
          });
          await tx.animeGenre.create({ data: { animeId: anime.id, genreId: genre.id } });
        }
      }

      return tx.anime.update({
        where: { id: anime.id },
        data: {
          anilistId: metadata.anilistId ?? anime.anilistId,
          jikanId: metadata.jikanId ?? anime.jikanId,
          kitsuId: metadata.kitsuId ?? anime.kitsuId,
          metadataSource: metadata.provider,
          lastSyncedAt: new Date(),
          title: metadata.title || anime.title,
          romajiTitle: metadata.romajiTitle ?? anime.romajiTitle,
          japaneseTitle: metadata.japaneseTitle ?? anime.japaneseTitle,
          alternativeTitle: metadata.alternativeTitle ?? anime.alternativeTitle,
          description: metadata.description ? sanitizeAnimeDescription(metadata.description) : anime.description,
          poster: anime.customPoster ? anime.poster : metadata.poster ?? anime.poster,
          banner: metadata.banner ?? anime.banner,
          releaseYear: metadata.releaseYear ?? anime.releaseYear,
          season: metadata.season ?? anime.season,
          durationMinutes: metadata.durationMinutes ?? anime.durationMinutes,
          sourceMaterial: metadata.sourceMaterial ?? anime.sourceMaterial,
          officialWebsite: metadata.officialWebsite ?? anime.officialWebsite,
          studio: metadata.studio ?? anime.studio,
          status: metadata.status ?? anime.status,
          rating: metadata.rating ?? anime.rating,
          popularity: metadata.popularity ?? anime.popularity,
          totalEpisodes: metadata.totalEpisodes ?? anime.totalEpisodes,
          type: metadata.type ?? anime.type,
        },
        select: { id: true, title: true, slug: true, metadataSource: true, lastSyncedAt: true },
      });
    });

    return Response.json({
      anime: updated,
      fallbackUsed: external.fallbackUsed,
      warning: external.fallbackUsed
        ? `The original provider was unavailable; metadata was synchronized from ${metadata.provider}.`
        : null,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "Synchronization would create a duplicate external ID or genre." }, { status: 409 });
    }
    return animeMetadataErrorResponse(error, "Anime metadata synchronization failed", "Anime metadata could not be synchronized.");
  }
}
