ALTER TABLE "Anime" ADD COLUMN "jikanId" INTEGER;

CREATE UNIQUE INDEX "Anime_jikanId_key" ON "Anime"("jikanId");
