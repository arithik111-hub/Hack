import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AniListApiError, getAniListAnime, getAniListBanner, getAniListCover, isAniListImageUrl } from "@/lib/anilist/client";
import { getDatabase } from "@/lib/db";

const importSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  alternativeTitle: z.string().trim().max(300),
  description: z.string().trim().min(10).max(5000),
  poster: z.string().url().refine(isAniListImageUrl, "Use an AniList cover image URL."),
  banner: z.string().url().refine(isAniListImageUrl, "Use an AniList artwork URL."),
  releaseYear: z.coerce.number().int().min(1900).max(2100),
  studio: z.string().trim().min(1).max(160),
  status: z.enum(["AIRING", "COMPLETED", "UPCOMING"]),
  rating: z.coerce.number().min(0).max(10),
  totalEpisodes: z.coerce.number().int().min(0).max(10000).nullable(),
  type: z.enum(["TV", "Movie", "OVA", "ONA"]),
  languages: z.array(z.string().trim().min(1).max(60)).max(10),
  genres: z.array(z.string().trim().min(1).max(80)).max(20),
});

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden." }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid AniList ID." }, { status: 400 });

  try {
    const [media, existing] = await Promise.all([
      getAniListAnime(id),
      getDatabase().anime.findUnique({ where: { anilistId: id }, select: { id: true, slug: true, title: true } }),
    ]);
    return Response.json({
      media,
      cover: getAniListCover(media),
      banner: getAniListBanner(media),
      existing,
    });
  } catch (error) {
    if (error instanceof AniListApiError) {
      return Response.json(
        { error: error.retryAfter ? `${error.message} Retry after ${error.retryAfter} seconds.` : error.message, retryAfter: error.retryAfter },
        { status: error.status },
      );
    }
    console.error("AniList detail lookup failed", error);
    return Response.json({ error: "Anime details could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const { id: rawId } = await context.params;
  const anilistId = Number(rawId);
  if (!Number.isSafeInteger(anilistId) || anilistId < 1) return Response.json({ error: "Invalid AniList ID." }, { status: 400 });

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Review the required metadata fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }

  try {
    const external = await getAniListAnime(anilistId);
    if (external.id !== anilistId) return Response.json({ error: "AniList record was not found." }, { status: 404 });

    const db = getDatabase();
    const duplicate = await db.anime.findFirst({
      where: {
        OR: [
          { anilistId },
          { slug: parsed.data.slug },
          { title: { equals: parsed.data.title, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, title: true },
    });
    if (duplicate) {
      return Response.json({ error: `A matching record already exists: ${duplicate.title}.`, duplicate }, { status: 409 });
    }

    const anime = await db.anime.create({
      data: {
        anilistId,
        metadataSource: "ANILIST",
        lastSyncedAt: new Date(),
        customPoster: false,
        title: parsed.data.title,
        slug: parsed.data.slug,
        alternativeTitle: parsed.data.alternativeTitle || null,
        description: parsed.data.description,
        poster: parsed.data.poster,
        banner: parsed.data.banner,
        releaseYear: parsed.data.releaseYear,
        studio: parsed.data.studio,
        status: parsed.data.status,
        rating: parsed.data.rating,
        totalEpisodes: parsed.data.totalEpisodes,
        type: parsed.data.type,
        languages: parsed.data.languages,
        published: false,
        featured: false,
        trending: false,
        popularity: 0,
        genres: parsed.data.genres.length ? {
          create: parsed.data.genres.map((name) => ({
            genre: {
              connectOrCreate: {
                where: { name },
                create: { name, slug: slugify(name) },
              },
            },
          })),
        } : undefined,
      },
      select: { id: true, title: true, slug: true, published: true },
    });
    return Response.json({ anime }, { status: 201 });
  } catch (error) {
    console.error("AniList import failed", error);
    return Response.json({ error: "Anime could not be imported. Check for duplicate genre names or slugs." }, { status: 500 });
  }
}
