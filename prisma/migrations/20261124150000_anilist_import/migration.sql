ALTER TABLE "Anime" ADD COLUMN "anilistId" INTEGER;

CREATE UNIQUE INDEX "Anime_anilistId_key" ON "Anime"("anilistId");
