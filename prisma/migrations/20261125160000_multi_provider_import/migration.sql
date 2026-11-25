CREATE TYPE "AnimeMetadataSource" AS ENUM ('MANUAL', 'ANILIST', 'JIKAN', 'KITSU');

ALTER TABLE "Anime"
  ADD COLUMN "kitsuId" TEXT,
  ADD COLUMN "romajiTitle" TEXT,
  ADD COLUMN "japaneseTitle" TEXT,
  ADD COLUMN "customPoster" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "season" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "sourceMaterial" TEXT,
  ADD COLUMN "officialWebsite" TEXT,
  ADD COLUMN "metadataSource" "AnimeMetadataSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Anime_kitsuId_key" ON "Anime"("kitsuId");

UPDATE "Anime"
SET "metadataSource" = 'ANILIST'
WHERE "anilistId" IS NOT NULL;

UPDATE "Anime"
SET "metadataSource" = 'JIKAN'
WHERE "metadataSource" = 'MANUAL'
  AND "jikanId" IS NOT NULL;

UPDATE "Anime"
SET "customPoster" = true
WHERE "poster" LIKE '%/storage/v1/object/public/animex-covers/%';

CREATE INDEX "Anime_popularity_idx" ON "Anime"("popularity");
CREATE INDEX "Anime_rating_idx" ON "Anime"("rating");

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT SELECT ON TABLE "Anime", "AnimeGenre", "Genre", "Season", "Episode" TO anon, authenticated;

ALTER TABLE "Anime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnimeGenre" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Genre" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Season" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Episode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaIngestionJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Watchlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_published_anime"
  ON "Anime"
  FOR SELECT
  TO anon, authenticated
  USING ("published" = true);

CREATE POLICY "public_read_published_anime_genres"
  ON "AnimeGenre"
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "Anime" AS anime
      WHERE anime."id" = "AnimeGenre"."animeId"
        AND anime."published" = true
    )
  );

CREATE POLICY "public_read_genres_in_published_anime"
  ON "Genre"
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "AnimeGenre" AS anime_genre
      JOIN "Anime" AS anime ON anime."id" = anime_genre."animeId"
      WHERE anime_genre."genreId" = "Genre"."id"
        AND anime."published" = true
    )
  );

CREATE POLICY "public_read_seasons_for_published_anime"
  ON "Season"
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "Anime" AS anime
      WHERE anime."id" = "Season"."animeId"
        AND anime."published" = true
    )
  );

CREATE POLICY "public_read_published_episodes"
  ON "Episode"
  FOR SELECT
  TO anon, authenticated
  USING (
    "published" = true
    AND EXISTS (
      SELECT 1
      FROM "Anime" AS anime
      WHERE anime."id" = "Episode"."animeId"
        AND anime."published" = true
    )
  );
