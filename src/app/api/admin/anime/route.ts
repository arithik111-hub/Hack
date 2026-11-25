import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const animeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  alternativeTitle: z.string().trim().max(300).optional(),
  description: z.string().trim().min(10).max(5000),
  poster: z.url().or(z.literal("/")).or(z.literal("/images/anime-cover-placeholder.svg")),
  banner: z.url().or(z.literal("/")),
  releaseYear: z.coerce.number().int().min(1900).max(2100),
  studio: z.string().trim().min(1).max(160),
  status: z.enum(["AIRING", "COMPLETED", "UPCOMING"]),
  rating: z.coerce.number().min(0).max(10),
  totalEpisodes: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  type: z.enum(["TV", "Movie", "OVA", "ONA"]),
  languages: z.array(z.string().trim().min(1)).min(1),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  published: z.boolean().optional(),
  customPoster: z.boolean().optional(),
  genreIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const genre = url.searchParams.get("genre")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "title";
  try {
    const db = getDatabase();
    const animes = await db.anime.findMany({
      where: {
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        ...(status ? { status: status as "AIRING" | "COMPLETED" | "UPCOMING" } : {}),
        ...(genre ? { genres: { some: { genre: { slug: genre } } } } : {}),
      },
      orderBy: sort === "release-desc" ? { releaseYear: "desc" } : sort === "release-asc" ? { releaseYear: "asc" } : sort === "newest" ? { createdAt: "desc" } : { title: "asc" },
      include: {
        genres: { include: { genre: { select: { name: true, slug: true } } } },
        _count: { select: { episodes: true } },
      },
    });
    const genres = await db.genre.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } });
    return Response.json({ animes, genres });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = animeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the anime fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

  try {
    const db = getDatabase();
    const existing = await db.anime.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
    if (existing) return Response.json({ error: "That slug is already in use." }, { status: 409 });

    const anime = await db.anime.create({
      data: {
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
        totalEpisodes: parsed.data.totalEpisodes ?? null,
        type: parsed.data.type,
        languages: parsed.data.languages,
        featured: parsed.data.featured ?? false,
        trending: parsed.data.trending ?? false,
        published: parsed.data.published ?? true,
        customPoster: parsed.data.customPoster ?? false,
        genres: parsed.data.genreIds?.length
          ? { create: parsed.data.genreIds.map((genreId) => ({ genre: { connect: { id: genreId } } })) }
          : undefined,
      },
      select: { id: true, slug: true },
    });
    return Response.json({ success: true, anime });
  } catch (error) {
    console.error("Anime create failed", error);
    return Response.json({ error: "Anime could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const idSchema = z.object({ id: z.string().min(1) });
  const idParsed = idSchema.safeParse(body);
  if (!idParsed.success) return Response.json({ error: "Anime ID is required." }, { status: 400 });
  if (typeof body === "object" && body !== null) {
    const settingSchema = z.object({
      id: z.string().min(1),
      published: z.boolean().optional(),
      featured: z.boolean().optional(),
      trending: z.boolean().optional(),
    });
    const settingParsed = settingSchema.safeParse(body);
    const hasSetting =
      settingParsed.success &&
      ("published" in body || "featured" in body || "trending" in body);
    if (hasSetting) {
      try {
        await getDatabase().anime.update({
          where: { id: idParsed.data.id },
          data: {
            ...(typeof (body as { published?: boolean }).published === "boolean"
              ? { published: (body as { published: boolean }).published }
              : {}),
            ...(typeof (body as { featured?: boolean }).featured === "boolean"
              ? { featured: (body as { featured: boolean }).featured }
              : {}),
            ...(typeof (body as { trending?: boolean }).trending === "boolean"
              ? { trending: (body as { trending: boolean }).trending }
              : {}),
          },
        });
        return Response.json({ success: true });
      } catch {
        return Response.json({ error: "Anime setting could not be updated." }, { status: 500 });
      }
    }
  }
  const parsed = animeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please check the anime fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

  try {
    const db = getDatabase();
    const duplicate = await db.anime.findFirst({ where: { slug: parsed.data.slug, NOT: { id: idParsed.data.id } }, select: { id: true } });
    if (duplicate) return Response.json({ error: "That slug is already in use." }, { status: 409 });
    await db.$transaction(async (tx) => {
      const current = await tx.anime.findUnique({
        where: { id: idParsed.data.id },
        select: { poster: true, customPoster: true },
      });
      if (!current) throw new Error("Anime not found.");
      await tx.anime.update({
        where: { id: idParsed.data.id },
        data: {
          title: parsed.data.title, slug: parsed.data.slug, alternativeTitle: parsed.data.alternativeTitle || null,
          description: parsed.data.description, poster: parsed.data.poster, banner: parsed.data.banner,
          customPoster: current.customPoster || current.poster !== parsed.data.poster,
          releaseYear: parsed.data.releaseYear, studio: parsed.data.studio, status: parsed.data.status,
          rating: parsed.data.rating, totalEpisodes: parsed.data.totalEpisodes ?? null, type: parsed.data.type,
          languages: parsed.data.languages, featured: parsed.data.featured ?? false,
          trending: parsed.data.trending ?? false, published: parsed.data.published ?? true,
        },
      });
      if (parsed.data.genreIds) {
        await tx.animeGenre.deleteMany({ where: { animeId: idParsed.data.id } });
        if (parsed.data.genreIds.length) {
          await tx.animeGenre.createMany({
            data: parsed.data.genreIds.map((genreId) => ({ animeId: idParsed.data.id, genreId })),
            skipDuplicates: true,
          });
        }
      }
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Anime update failed", error);
    return Response.json({ error: "Anime could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Anime ID is required." }, { status: 400 });
  try {
    const db = getDatabase();
    const counts = await db.anime.findUnique({
      where: { id: parsed.data.id },
      select: { _count: { select: { seasons: true, episodes: true, watchlist: true, favorites: true } } },
    });
    if (!counts) return Response.json({ error: "Anime not found." }, { status: 404 });
    await db.anime.delete({ where: { id: parsed.data.id } });
    return Response.json({ success: true, deletedRelationships: counts._count });
  } catch (error) {
    console.error("Anime delete failed", error);
    return Response.json({ error: "Anime could not be deleted." }, { status: 500 });
  }
}
