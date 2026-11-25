import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { findAnimeDuplicates } from "@/lib/anime-metadata-db";
import { animeMetadataErrorResponse } from "@/lib/anime-metadata-http";
import {
  getAnimeMetadataDetails,
  isTrustedAnimeImageUrl,
  sanitizeAnimeDescription,
} from "@/lib/anime-metadata";
import { getDatabase } from "@/lib/db";

const providerSchema = z.enum(["ANILIST", "JIKAN", "KITSU"]);
const genreSchema = z.array(z.string().trim().min(1).max(80)).max(20);

const importSchema = z.object({
  provider: providerSchema,
  providerId: z.string().regex(/^\d{1,12}$/),
  providerTitle: z.string().trim().min(2).max(160),
  anilistId: z.number().int().positive().nullable(),
  jikanId: z.number().int().positive().nullable(),
  kitsuId: z.string().regex(/^\d{1,12}$/).nullable(),
  title: z.string().trim().min(2).max(160),
  romajiTitle: z.string().trim().max(300).nullable(),
  japaneseTitle: z.string().trim().max(300).nullable(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  alternativeTitle: z.string().trim().max(500).nullable(),
  description: z.string().trim().min(10).max(5000),
  poster: z.string().trim().min(1).refine(isTrustedAnimeImageUrl, "Use a trusted provider, ANIMEX storage, or fallback image URL."),
  banner: z.string().trim().min(1).refine(isTrustedAnimeImageUrl, "Use a trusted provider, ANIMEX storage, or fallback image URL."),
  releaseYear: z.coerce.number().int().min(1900).max(2100),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).nullable(),
  durationMinutes: z.coerce.number().int().min(1).max(1200).nullable(),
  sourceMaterial: z.string().trim().max(120).nullable(),
  officialWebsite: z.string().url().nullable().refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Official websites must use a secure HTTPS URL."),
  studio: z.string().trim().min(1).max(300),
  status: z.enum(["AIRING", "COMPLETED", "UPCOMING"]),
  rating: z.coerce.number().min(0).max(10),
  popularity: z.coerce.number().int().min(0).max(2_000_000_000),
  totalEpisodes: z.coerce.number().int().min(0).max(10000).nullable(),
  type: z.enum(["TV", "Movie", "OVA", "ONA"]),
  languages: z.array(z.string().trim().min(1).max(60)).max(10),
  genres: genreSchema,
  published: z.boolean().default(true),
});

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Review the required metadata fields.", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const values = parsed.data;
  try {
    const external = await getAnimeMetadataDetails(values.provider, values.providerId, {
      anilistId: values.anilistId,
      jikanId: values.jikanId,
      kitsuId: values.kitsuId,
    }, values.providerTitle);
    const metadata = external.media;
    if (
      metadata.provider !== values.provider &&
      !(
        (metadata.provider === "ANILIST" && metadata.anilistId === values.anilistId) ||
        (metadata.provider === "JIKAN" && metadata.jikanId === values.jikanId) ||
        (metadata.provider === "KITSU" && metadata.kitsuId === values.kitsuId)
      )
    ) {
      return Response.json({ error: "The selected provider record could not be verified." }, { status: 409 });
    }

    const [duplicate] = await findAnimeDuplicates([metadata], { slug: values.slug });
    if (duplicate) {
      return Response.json({
        error: `A matching anime already exists: ${duplicate.title}.`,
        duplicate,
      }, { status: 409 });
    }

    const genres = [...new Map(values.genres.map((name) => [name.toLowerCase(), name])).values()];
    const genreConnections = genres.map((name) => {
      const slug = slugify(name);
      if (!slug) throw new Error(`The genre "${name}" cannot be converted to a catalogue slug.`);
      return {
        genre: {
          connectOrCreate: {
            where: { name },
            create: { name, slug },
          },
        },
      };
    });

    const anime = await getDatabase().anime.create({
      data: {
        anilistId: metadata.anilistId,
        jikanId: metadata.jikanId,
        kitsuId: metadata.kitsuId,
        metadataSource: metadata.provider,
        lastSyncedAt: new Date(),
        romajiTitle: values.romajiTitle || null,
        japaneseTitle: values.japaneseTitle || null,
        title: values.title,
        slug: values.slug,
        alternativeTitle: values.alternativeTitle || null,
        description: sanitizeAnimeDescription(values.description),
        poster: values.poster,
        banner: values.banner,
        customPoster: Boolean(metadata.poster && values.poster !== metadata.poster),
        releaseYear: values.releaseYear,
        season: values.season,
        durationMinutes: values.durationMinutes,
        sourceMaterial: values.sourceMaterial || null,
        officialWebsite: values.officialWebsite || null,
        studio: values.studio,
        status: values.status,
        rating: values.rating,
        popularity: values.popularity,
        totalEpisodes: values.totalEpisodes,
        type: values.type,
        languages: values.languages,
        published: values.published,
        featured: false,
        trending: false,
        genres: genreConnections.length ? { create: genreConnections } : undefined,
      },
      select: { id: true, title: true, slug: true, published: true },
    });

    return Response.json({ anime }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "A duplicate anime or genre record already exists." }, { status: 409 });
    }
    return animeMetadataErrorResponse(error, "Anime metadata import failed", "Anime could not be imported.");
  }
}
