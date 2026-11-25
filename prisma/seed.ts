import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { animeCatalog, animeEpisodes, animeSeasons, genreOptions } from "../src/data/anime";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed ANIMEX.");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const genres = new Map(
    await Promise.all(
      genreOptions.map((name) =>
        prisma.genre.upsert({
          where: { name },
          update: {},
          create: {
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          },
        }),
      ),
    ).then((entries) => entries.map((entry) => [entry.name, entry.id])),
  );

  for (const anime of animeCatalog) {
    const existingAnime = await prisma.anime.findUnique({
      where: { slug: anime.slug },
      select: { poster: true, customPoster: true },
    });
    const poster = existingAnime?.customPoster ? existingAnime.poster : anime.poster;

    await prisma.anime.upsert({
      where: { slug: anime.slug },
      update: {
        title: anime.title,
        alternativeTitle: anime.alternativeTitles.join(" · "),
        description: anime.description,
        poster,
        banner: anime.banner,
        rating: anime.rating,
        releaseYear: anime.releaseYear,
        studio: anime.studio,
        status: anime.status.toUpperCase() as "AIRING" | "COMPLETED" | "UPCOMING",
        type: anime.type,
        languages: anime.languages,
        totalEpisodes: anime.totalEpisodes,
        popularity: anime.popularity,
        published: true,
        featured: anime.featured ?? false,
      },
      create: {
        slug: anime.slug,
        title: anime.title,
        alternativeTitle: anime.alternativeTitles.join(" · "),
        description: anime.description,
        poster: anime.poster,
        banner: anime.banner,
        rating: anime.rating,
        releaseYear: anime.releaseYear,
        studio: anime.studio,
        status: anime.status.toUpperCase() as "AIRING" | "COMPLETED" | "UPCOMING",
        type: anime.type,
        languages: anime.languages,
        totalEpisodes: anime.totalEpisodes,
        popularity: anime.popularity,
        published: true,
        featured: anime.featured ?? false,
      },
    });

    const dbAnime = await prisma.anime.findUniqueOrThrow({
      where: { slug: anime.slug },
    });

    await prisma.animeGenre.deleteMany({ where: { animeId: dbAnime.id } });
    await prisma.animeGenre.createMany({
      data: anime.genres
        .map((genre) => genres.get(genre))
        .filter((genreId): genreId is string => Boolean(genreId))
        .map((genreId) => ({ animeId: dbAnime.id, genreId })),
      skipDuplicates: true,
    });

    const seasons = animeSeasons.filter((season) => season.animeId === anime.id);
    for (const season of seasons) {
      await prisma.season.upsert({
        where: {
          animeId_seasonNumber: {
            animeId: dbAnime.id,
            seasonNumber: season.seasonNumber,
          },
        },
        update: {
          title: season.title,
          episodeCount: season.episodeCount,
        },
        create: {
          animeId: dbAnime.id,
          seasonNumber: season.seasonNumber,
          title: season.title,
          episodeCount: season.episodeCount,
        },
      });

      const dbSeason = await prisma.season.findUniqueOrThrow({
        where: {
          animeId_seasonNumber: {
            animeId: dbAnime.id,
            seasonNumber: season.seasonNumber,
          },
        },
      });

      const episodes = animeEpisodes.filter(
        (episode) =>
          episode.animeId === anime.id && episode.seasonId === season.id,
      );
      for (const episode of episodes) {
        await prisma.episode.upsert({
          where: {
            seasonId_episodeNumber: {
              seasonId: dbSeason.id,
              episodeNumber: episode.episodeNumber,
            },
          },
          update: {
            title: episode.title,
            description: episode.description,
            thumbnail: episode.thumbnail,
            duration: episode.duration,
            releaseDate: new Date(`${episode.releaseDate}T00:00:00.000Z`),
            published: true,
          },
          create: {
            animeId: dbAnime.id,
            seasonId: dbSeason.id,
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            description: episode.description,
            thumbnail: episode.thumbnail,
            duration: episode.duration,
            releaseDate: new Date(`${episode.releaseDate}T00:00:00.000Z`),
            published: true,
          },
        });
      }
    }
  }

  if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    const email = process.env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: {
        name: "ANIMEX Administrator",
        email,
        passwordHash: await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12),
        role: "ADMIN",
      },
    });
  }
}

main()
  .then(() => console.log("ANIMEX seed completed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
