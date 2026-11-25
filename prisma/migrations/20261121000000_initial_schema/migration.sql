CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "AnimeStatus" AS ENUM ('AIRING', 'COMPLETED', 'UPCOMING');
CREATE TYPE "SourceType" AS ENUM ('EMBED', 'HLS', 'MP4', 'OTHER');

CREATE TABLE "User" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "image" TEXT, "role" "UserRole" NOT NULL DEFAULT 'USER', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE TABLE "Anime" ("id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "alternativeTitle" TEXT, "description" TEXT NOT NULL, "poster" TEXT NOT NULL, "banner" TEXT NOT NULL, "rating" DOUBLE PRECISION NOT NULL DEFAULT 0, "releaseYear" INTEGER NOT NULL, "studio" TEXT NOT NULL, "status" "AnimeStatus" NOT NULL DEFAULT 'COMPLETED', "type" TEXT NOT NULL DEFAULT 'TV', "languages" TEXT[] NOT NULL, "totalEpisodes" INTEGER, "featured" BOOLEAN NOT NULL DEFAULT false, "trending" BOOLEAN NOT NULL DEFAULT false, "published" BOOLEAN NOT NULL DEFAULT true, "popularity" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Anime_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");
CREATE INDEX "Anime_published_status_idx" ON "Anime"("published", "status");
CREATE INDEX "Anime_releaseYear_idx" ON "Anime"("releaseYear");
CREATE INDEX "Anime_featured_trending_idx" ON "Anime"("featured", "trending");
CREATE INDEX "Anime_createdAt_idx" ON "Anime"("createdAt");

CREATE TABLE "Genre" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Genre_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");
CREATE INDEX "Genre_slug_idx" ON "Genre"("slug");

CREATE TABLE "AnimeGenre" ("animeId" TEXT NOT NULL, "genreId" TEXT NOT NULL, CONSTRAINT "AnimeGenre_pkey" PRIMARY KEY ("animeId", "genreId"));
CREATE INDEX "AnimeGenre_genreId_idx" ON "AnimeGenre"("genreId");
ALTER TABLE "AnimeGenre" ADD CONSTRAINT "AnimeGenre_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimeGenre" ADD CONSTRAINT "AnimeGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Season" ("id" TEXT NOT NULL, "animeId" TEXT NOT NULL, "seasonNumber" INTEGER NOT NULL, "title" TEXT NOT NULL, "episodeCount" INTEGER NOT NULL DEFAULT 0, "releaseYear" INTEGER, CONSTRAINT "Season_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Season_animeId_seasonNumber_key" ON "Season"("animeId", "seasonNumber");
CREATE INDEX "Season_animeId_idx" ON "Season"("animeId");
ALTER TABLE "Season" ADD CONSTRAINT "Season_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Episode" ("id" TEXT NOT NULL, "animeId" TEXT NOT NULL, "seasonId" TEXT NOT NULL, "episodeNumber" INTEGER NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "thumbnail" TEXT NOT NULL, "duration" INTEGER NOT NULL, "releaseDate" TIMESTAMP(3) NOT NULL, "published" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "Episode_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Episode_seasonId_episodeNumber_key" ON "Episode"("seasonId", "episodeNumber");
CREATE INDEX "Episode_animeId_published_idx" ON "Episode"("animeId", "published");
CREATE INDEX "Episode_seasonId_episodeNumber_idx" ON "Episode"("seasonId", "episodeNumber");
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VideoSource" ("id" TEXT NOT NULL, "episodeId" TEXT NOT NULL, "provider" TEXT NOT NULL, "sourceType" "SourceType" NOT NULL DEFAULT 'EMBED', "playbackReference" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false, CONSTRAINT "VideoSource_pkey" PRIMARY KEY ("id"));
CREATE INDEX "VideoSource_episodeId_isActive_idx" ON "VideoSource"("episodeId", "isActive");
ALTER TABLE "VideoSource" ADD CONSTRAINT "VideoSource_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WatchHistory" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "episodeId" TEXT NOT NULL, "progressSeconds" INTEGER NOT NULL DEFAULT 0, "completed" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "WatchHistory_userId_episodeId_key" ON "WatchHistory"("userId", "episodeId");
CREATE INDEX "WatchHistory_userId_updatedAt_idx" ON "WatchHistory"("userId", "updatedAt");
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Watchlist" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "animeId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Watchlist_userId_animeId_key" ON "Watchlist"("userId", "animeId");
CREATE INDEX "Watchlist_animeId_idx" ON "Watchlist"("animeId");
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Favorite" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "animeId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Favorite_userId_animeId_key" ON "Favorite"("userId", "animeId");
CREATE INDEX "Favorite_animeId_idx" ON "Favorite"("animeId");
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
