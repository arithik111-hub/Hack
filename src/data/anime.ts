export type AnimeStatus = "Airing" | "Completed" | "Upcoming";
export type AnimeType = "TV" | "Movie" | "OVA" | "ONA";

export type AnimeGenre =
  | "Action"
  | "Adventure"
  | "Comedy"
  | "Drama"
  | "Fantasy"
  | "Horror"
  | "Mystery"
  | "Psychological"
  | "Romance"
  | "Slice of Life"
  | "Sci-Fi"
  | "Sports"
  | "Supernatural"
  | "Thriller";

export type Anime = {
  id: string;
  slug: string;
  title: string;
  romajiTitle?: string | null;
  japaneseTitle?: string | null;
  alternativeTitles: string[];
  description: string;
  poster: string;
  banner: string;
  rating: number;
  popularity: number;
  featured?: boolean;
  releaseYear: number;
  season?: string | null;
  durationMinutes?: number | null;
  sourceMaterial?: string | null;
  officialWebsite?: string | null;
  genres: AnimeGenre[];
  studio: string;
  status: AnimeStatus;
  type: AnimeType;
  languages: string[];
  totalEpisodes: number | null;
  accent: string;
  source?: "ANILIST" | "JIKAN" | "KITSU";
  createdAt?: string;
};

export type Season = {
  id: string;
  animeId: string;
  seasonNumber: number;
  title: string;
  episodeCount: number;
};

export type Episode = {
  id: string;
  animeId: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  releaseDate: string;
  playbackAvailable: boolean;
};

type AnimeSeed = Omit<Anime, "poster" | "banner"> & {
  artwork: string;
};

const unsplash = (photo: string, width: number) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=82`;

const animeSeeds: AnimeSeed[] = [
  {
    id: "anime-eclipse-zero",
    slug: "eclipse-zero",
    title: "Eclipse Zero",
    alternativeTitles: ["Eclipse Zero", "ECLIPSE ZERO"],
    description:
      "When the neon eclipse awakens over the city, a chosen group of warriors must face the shadow force threatening to erase their world.",
    artwork: "/images/eclipse-zero-neon-eclipse-poster.png",
    rating: 9.2,
    popularity: 100,
    featured: true,
    releaseYear: 2026,
    genres: ["Action", "Fantasy", "Sci-Fi", "Supernatural"],
    studio: "ANIMEX Originals",
    status: "Airing",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 12,
    accent: "#704be0",
  },
  {
    id: "anime-001",
    slug: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    alternativeTitles: ["呪術廻戦", "Sorcery Fight"],
    description:
      "A high school student enters a hidden world of cursed spirits and joins a close-knit group determined to protect people from supernatural threats.",
    artwork: "photo-1578632767115-351597cf2477",
    rating: 8.7,
    popularity: 99,
    releaseYear: 2020,
    genres: ["Action", "Fantasy", "Supernatural", "Thriller"],
    studio: "MAPPA",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 47,
    accent: "#6d49bd",
  },
  {
    id: "anime-002",
    slug: "frieren-beyond-journeys-end",
    title: "Frieren: Beyond Journey's End",
    alternativeTitles: ["Sousou no Frieren", "葬送のフリーレン"],
    description:
      "After the adventure is over, an elven mage sets out to understand the fleeting lives and memories of her former companions.",
    artwork: "photo-1519608487953-e999c86e7455",
    rating: 9.3,
    popularity: 96,
    releaseYear: 2023,
    genres: ["Adventure", "Drama", "Fantasy"],
    studio: "Madhouse",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 28,
    accent: "#6073ac",
  },
  {
    id: "anime-003",
    slug: "solo-leveling",
    title: "Solo Leveling",
    alternativeTitles: ["Ore dake Level Up na Ken", "나 혼자만 레벨업"],
    description:
      "In a world of monster-filled gates, one hunter discovers a mysterious power that lets him grow stronger with every challenge.",
    artwork: "photo-1534447677768-be436bb09401",
    rating: 8.4,
    popularity: 94,
    releaseYear: 2024,
    genres: ["Action", "Fantasy"],
    studio: "A-1 Pictures",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 25,
    accent: "#473990",
  },
  {
    id: "anime-004",
    slug: "demon-slayer",
    title: "Demon Slayer: Kimetsu no Yaiba",
    alternativeTitles: ["Kimetsu no Yaiba", "鬼滅の刃"],
    description:
      "A determined young swordsman joins the Demon Slayer Corps and searches for a way to restore his sister's humanity.",
    artwork: "photo-1500530855697-b586d89ba3ee",
    rating: 8.6,
    popularity: 98,
    releaseYear: 2019,
    genres: ["Action", "Adventure", "Fantasy"],
    studio: "ufotable",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 63,
    accent: "#ba553f",
  },
  {
    id: "anime-005",
    slug: "spy-x-family",
    title: "SPY x FAMILY",
    alternativeTitles: ["Spy Family", "スパイファミリー"],
    description:
      "A spy, an assassin, and a telepath form an unlikely family while each keeps their real identity a secret.",
    artwork: "photo-1541562232579-512a21360020",
    rating: 8.5,
    popularity: 91,
    releaseYear: 2022,
    genres: ["Action", "Comedy", "Drama"],
    studio: "Wit Studio / CloverWorks",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 37,
    accent: "#617b55",
  },
  {
    id: "anime-006",
    slug: "chainsaw-man",
    title: "Chainsaw Man",
    alternativeTitles: ["チェンソーマン"],
    description:
      "A young devil hunter gets a second chance at life and is pulled into the dangerous world of Public Safety Devil Hunters.",
    artwork: "photo-1518709268805-4e9042af9f23",
    rating: 8.4,
    popularity: 92,
    releaseYear: 2022,
    genres: ["Action", "Drama", "Horror", "Supernatural"],
    studio: "MAPPA",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 12,
    accent: "#a54438",
  },
  {
    id: "anime-007",
    slug: "attack-on-titan",
    title: "Attack on Titan",
    alternativeTitles: ["Shingeki no Kyojin", "進撃の巨人"],
    description:
      "Humanity's last survivors live behind towering walls until a sudden attack changes the fate of the world.",
    artwork: "photo-1470252649378-9c29740c9fa8",
    rating: 9.1,
    popularity: 97,
    releaseYear: 2013,
    genres: ["Action", "Drama", "Fantasy", "Thriller"],
    studio: "Wit Studio / MAPPA",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 89,
    accent: "#a26443",
  },
  {
    id: "anime-008",
    slug: "my-hero-academia",
    title: "My Hero Academia",
    alternativeTitles: ["Boku no Hero Academia", "僕のヒーローアカデミア"],
    description:
      "A determined teenager pursues his dream of becoming a hero in a society where extraordinary abilities are common.",
    artwork: "photo-1500534623283-312aade485b7",
    rating: 8.2,
    popularity: 90,
    releaseYear: 2016,
    genres: ["Action", "Adventure", "Comedy"],
    studio: "Bones",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 159,
    accent: "#58894b",
  },
  {
    id: "anime-009",
    slug: "one-piece",
    title: "One Piece",
    alternativeTitles: ["ワンピース"],
    description:
      "A fearless crew sails toward the world's greatest treasure, finding strange islands and unforgettable allies along the way.",
    artwork: "photo-1527489377706-5bf97e608852",
    rating: 9.0,
    popularity: 100,
    releaseYear: 1999,
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    studio: "Toei Animation",
    status: "Airing",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 1122,
    accent: "#317d9d",
  },
  {
    id: "anime-010",
    slug: "blue-lock",
    title: "Blue Lock",
    alternativeTitles: ["ブルーロック"],
    description:
      "A bold training program brings young strikers together to compete for a place at the top of Japanese football.",
    artwork: "photo-1504016798967-59a258e9386d",
    rating: 8.1,
    popularity: 84,
    releaseYear: 2022,
    genres: ["Drama", "Sports"],
    studio: "Eight Bit",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 38,
    accent: "#4074bd",
  },
  {
    id: "anime-011",
    slug: "vinland-saga",
    title: "Vinland Saga",
    alternativeTitles: ["ヴィンランド・サガ"],
    description:
      "A young warrior's search for purpose unfolds across a harsh landscape shaped by loyalty, loss, and ambition.",
    artwork: "photo-1500534623283-312aade485b7",
    rating: 8.8,
    popularity: 86,
    releaseYear: 2019,
    genres: ["Action", "Adventure", "Drama"],
    studio: "Wit Studio / MAPPA",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 48,
    accent: "#9b6b40",
  },
  {
    id: "anime-012",
    slug: "the-apothecary-diaries",
    title: "The Apothecary Diaries",
    alternativeTitles: ["Kusuriya no Hitorigoto", "薬屋のひとりごと"],
    description:
      "A sharp-minded apothecary uses her knowledge of medicine to untangle mysteries inside an imperial court.",
    artwork: "photo-1518837695005-2083093ee35b",
    rating: 8.9,
    popularity: 87,
    releaseYear: 2023,
    genres: ["Drama", "Mystery"],
    studio: "TOHO animation / OLM",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 48,
    accent: "#ba7382",
  },
  {
    id: "anime-013",
    slug: "your-name",
    title: "Your Name.",
    alternativeTitles: ["Kimi no Na wa.", "君の名は。"],
    description:
      "Two teenagers who have never met begin waking in each other's lives, connected by a mystery that reaches across time.",
    artwork: "photo-1500530855697-b586d89ba3ee",
    rating: 8.8,
    popularity: 89,
    releaseYear: 2016,
    genres: ["Drama", "Fantasy", "Romance"],
    studio: "CoMix Wave Films",
    status: "Completed",
    type: "Movie",
    languages: ["Japanese", "English dub"],
    totalEpisodes: null,
    accent: "#728dbd",
  },
  {
    id: "anime-014",
    slug: "spirited-away",
    title: "Spirited Away",
    alternativeTitles: ["Sen to Chihiro no Kamikakushi", "千と千尋の神隠し"],
    description:
      "A curious girl finds herself in a mysterious spirit world and must find her courage to bring her family home.",
    artwork: "photo-1470252649378-9c29740c9fa8",
    rating: 9.3,
    popularity: 93,
    releaseYear: 2001,
    genres: ["Adventure", "Fantasy"],
    studio: "Studio Ghibli",
    status: "Completed",
    type: "Movie",
    languages: ["Japanese", "English dub"],
    totalEpisodes: null,
    accent: "#659a7d",
  },
  {
    id: "anime-015",
    slug: "suzume",
    title: "Suzume",
    alternativeTitles: ["Suzume no Tojimari", "すずめの戸締まり"],
    description:
      "A high school student joins a mysterious traveler on a journey to close doors that threaten the world around them.",
    artwork: "photo-1519608487953-e999c86e7455",
    rating: 8.2,
    popularity: 80,
    releaseYear: 2022,
    genres: ["Adventure", "Drama", "Fantasy"],
    studio: "CoMix Wave Films",
    status: "Completed",
    type: "Movie",
    languages: ["Japanese", "English dub"],
    totalEpisodes: null,
    accent: "#7d75b6",
  },
  {
    id: "anime-016",
    slug: "naruto",
    title: "Naruto",
    alternativeTitles: ["NARUTO -ナルト-"],
    description:
      "An energetic young ninja works toward his dream of becoming the leader of his village and earning everyone's respect.",
    artwork: "photo-1548013146-72479768bada",
    rating: 8.4,
    popularity: 96,
    releaseYear: 2002,
    genres: ["Action", "Adventure", "Comedy"],
    studio: "Pierrot",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 220,
    accent: "#bf6c35",
  },
  {
    id: "anime-017",
    slug: "death-note",
    title: "Death Note",
    alternativeTitles: ["デスノート"],
    description:
      "A brilliant student gains the power to determine life and death, setting off a tense battle of strategy and ideals.",
    artwork: "photo-1534447677768-be436bb09401",
    rating: 8.6,
    popularity: 92,
    releaseYear: 2006,
    genres: ["Mystery", "Psychological", "Supernatural", "Thriller"],
    studio: "Madhouse",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 37,
    accent: "#57536f",
  },
  {
    id: "anime-018",
    slug: "fullmetal-alchemist-brotherhood",
    title: "Fullmetal Alchemist: Brotherhood",
    alternativeTitles: ["Hagane no Renkinjutsushi: Fullmetal Alchemist", "鋼の錬金術師"],
    description:
      "Two brothers search for a way to restore what they lost after a forbidden experiment, uncovering a conspiracy along the way.",
    artwork: "photo-1518709268805-4e9042af9f23",
    rating: 9.1,
    popularity: 91,
    releaseYear: 2009,
    genres: ["Action", "Adventure", "Drama", "Fantasy"],
    studio: "Bones",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 64,
    accent: "#9e5e3d",
  },
  {
    id: "anime-019",
    slug: "bleach",
    title: "Bleach",
    alternativeTitles: ["BLEACH", "ブリーチ"],
    description:
      "A teenager's life changes when he inherits the duties of a Soul Reaper and must protect the living world.",
    artwork: "photo-1519608487953-e999c86e7455",
    rating: 8.2,
    popularity: 89,
    releaseYear: 2004,
    genres: ["Action", "Adventure", "Supernatural"],
    studio: "Pierrot",
    status: "Airing",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 366,
    accent: "#4b5e91",
  },
  {
    id: "anime-020",
    slug: "dragon-ball",
    title: "Dragon Ball",
    alternativeTitles: ["ドラゴンボール"],
    description:
      "A cheerful martial artist travels the world with new friends in search of the mystical Dragon Balls.",
    artwork: "photo-1527489377706-5bf97e608852",
    rating: 8.0,
    popularity: 88,
    releaseYear: 1986,
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    studio: "Toei Animation",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 153,
    accent: "#ce853b",
  },
  {
    id: "anime-021",
    slug: "hunter-x-hunter",
    title: "Hunter x Hunter",
    alternativeTitles: ["HUNTER×HUNTER", "ハンター×ハンター"],
    description:
      "A young boy sets out to become a Hunter and discover what made his absent father choose a life of adventure.",
    artwork: "photo-1500530855697-b586d89ba3ee",
    rating: 9.0,
    popularity: 90,
    releaseYear: 2011,
    genres: ["Action", "Adventure", "Fantasy"],
    studio: "Madhouse",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 148,
    accent: "#5c8b69",
  },
  {
    id: "anime-022",
    slug: "tokyo-revengers",
    title: "Tokyo Revengers",
    alternativeTitles: ["東京リベンジャーズ"],
    description:
      "A drifting young man gets a chance to change the past and protect the people whose lives once shaped his own.",
    artwork: "photo-1541562232579-512a21360020",
    rating: 7.8,
    popularity: 83,
    releaseYear: 2021,
    genres: ["Action", "Drama", "Supernatural"],
    studio: "Liden Films",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 50,
    accent: "#a54f50",
  },
  {
    id: "anime-023",
    slug: "cowboy-bebop",
    title: "Cowboy Bebop",
    alternativeTitles: ["カウボーイビバップ"],
    description:
      "A crew of bounty hunters drifts between planets, taking dangerous jobs while each carries a past they cannot quite outrun.",
    artwork: "photo-1534796636912-3b95b3ab5986",
    rating: 8.7,
    popularity: 85,
    releaseYear: 1998,
    genres: ["Action", "Drama", "Sci-Fi"],
    studio: "Sunrise",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 26,
    accent: "#54728f",
  },
  {
    id: "anime-024",
    slug: "tokyo-ghoul",
    title: "Tokyo Ghoul",
    alternativeTitles: ["東京喰種トーキョーグール"],
    description:
      "After a chance encounter changes his life, a quiet student is caught between human society and the ghouls who live among them.",
    artwork: "photo-1519608487953-e999c86e7455",
    rating: 7.8,
    popularity: 86,
    releaseYear: 2014,
    genres: ["Action", "Drama", "Horror", "Supernatural"],
    studio: "Pierrot",
    status: "Completed",
    type: "TV",
    languages: ["Japanese", "English dub"],
    totalEpisodes: 12,
    accent: "#78434d",
  },
];

const animeCoverBySlug: Partial<Record<string, string>> = {
  "attack-on-titan": "/images/anime-covers/attack-on-titan.png",
  bleach: "/images/anime-covers/bleach.png",
  "demon-slayer": "/images/anime-covers/demon-slayer.png",
  "fullmetal-alchemist-brotherhood": "/images/anime-covers/fullmetal-alchemist-brotherhood.png",
  "hunter-x-hunter": "/images/anime-covers/hunter-x-hunter.png",
  "jujutsu-kaisen": "/images/anime-covers/jujutsu-kaisen.png",
  naruto: "/images/anime-covers/naruto.png",
  "one-piece": "/images/anime-covers/one-piece.png",
  "spy-x-family": "/images/anime-covers/spy-x-family.png",
  "tokyo-ghoul": "/images/anime-covers/tokyo-ghoul.png",
};

export const animeCatalog: Anime[] = animeSeeds.map(({ artwork, ...anime }) => ({
  ...anime,
  poster:
    animeCoverBySlug[anime.slug] ??
    (artwork.startsWith("/") ? artwork : unsplash(artwork, 760)),
  banner: artwork.startsWith("/") ? artwork : unsplash(artwork, 2000),
}));

export const genreOptions: AnimeGenre[] = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Psychological",
  "Romance",
  "Slice of Life",
  "Sci-Fi",
  "Sports",
  "Supernatural",
  "Thriller",
];

type SeasonDefinition = {
  title: string;
  episodeCount: number;
};

const seasonDefinitions: Partial<Record<string, SeasonDefinition[]>> = {
  "jujutsu-kaisen": [
    { title: "Season 1", episodeCount: 24 },
    { title: "Season 2", episodeCount: 23 },
  ],
  "solo-leveling": [
    { title: "Season 1", episodeCount: 12 },
    { title: "Season 2", episodeCount: 13 },
  ],
  "demon-slayer": [
    { title: "Season 1", episodeCount: 26 },
    { title: "Mugen Train Arc", episodeCount: 7 },
    { title: "Entertainment District Arc", episodeCount: 11 },
    { title: "Swordsmith Village Arc", episodeCount: 11 },
    { title: "Hashira Training Arc", episodeCount: 8 },
  ],
  "spy-x-family": [
    { title: "Season 1", episodeCount: 25 },
    { title: "Season 2", episodeCount: 12 },
  ],
  "attack-on-titan": [
    { title: "Season 1", episodeCount: 25 },
    { title: "Season 2", episodeCount: 12 },
    { title: "Season 3", episodeCount: 22 },
    { title: "The Final Season", episodeCount: 30 },
  ],
  "my-hero-academia": [
    { title: "Season 1", episodeCount: 13 },
    { title: "Season 2", episodeCount: 25 },
    { title: "Season 3", episodeCount: 25 },
    { title: "Season 4", episodeCount: 25 },
    { title: "Season 5", episodeCount: 25 },
    { title: "Season 6", episodeCount: 25 },
    { title: "Season 7", episodeCount: 21 },
  ],
  "blue-lock": [
    { title: "Season 1", episodeCount: 24 },
    { title: "Season 2", episodeCount: 14 },
  ],
  "vinland-saga": [
    { title: "Season 1", episodeCount: 24 },
    { title: "Season 2", episodeCount: 24 },
  ],
  "the-apothecary-diaries": [
    { title: "Season 1", episodeCount: 24 },
    { title: "Season 2", episodeCount: 24 },
  ],
  bleach: [
    { title: "Original Series", episodeCount: 366 },
  ],
  "tokyo-revengers": [
    { title: "Season 1", episodeCount: 24 },
    { title: "Season 2", episodeCount: 13 },
    { title: "Season 3", episodeCount: 13 },
  ],
};

export const animeSeasons: Season[] = animeCatalog
  .filter((anime) => anime.type !== "Movie")
  .flatMap((anime) => {
    const definitions =
      seasonDefinitions[anime.slug] ??
      [{ title: "Season 1", episodeCount: anime.totalEpisodes ?? 1 }];

    return definitions.map((definition, index) => ({
      id: `${anime.id}-season-${index + 1}`,
      animeId: anime.id,
      seasonNumber: index + 1,
      title: definition.title,
      episodeCount: definition.episodeCount,
    }));
  });

const episodeTitleSamples = [
  "A New Beginning",
  "An Unexpected Encounter",
  "The Path Forward",
];

export const animeEpisodes: Episode[] = animeSeasons.flatMap((season) => {
  const anime = animeCatalog.find((entry) => entry.id === season.animeId);
  if (!anime) return [];

  return episodeTitleSamples.map((title, index) => {
    const episodeNumber = index + 1;
    const month = String(Math.min(season.seasonNumber, 12)).padStart(2, "0");
    const day = String((index + 1) * 7).padStart(2, "0");

    return {
      id: `${season.id}-episode-${episodeNumber}`,
      animeId: anime.id,
      seasonId: season.id,
      episodeNumber,
      title,
      description: `Sample episode entry for ${anime.title}, ${season.title}. A verified video source is not configured.`,
      thumbnail: anime.banner,
      duration: 24,
      releaseDate: `${anime.releaseYear}-${month}-${day}`,
      playbackAvailable: false,
    };
  });
});

export const featuredAnime = animeCatalog.slice(0, 3);

export function getAnimeBySlug(slug: string) {
  return animeCatalog.find((anime) => anime.slug === slug);
}

export function getAnimeById(animeId: string) {
  return animeCatalog.find((anime) => anime.id === animeId);
}

export function getAnimeSeasons(animeId: string) {
  return animeSeasons
    .filter((season) => season.animeId === animeId)
    .sort((first, second) => first.seasonNumber - second.seasonNumber);
}

export function getAnimeEpisodes(animeId: string, seasonId: string) {
  return animeEpisodes
    .filter(
      (episode) =>
        episode.animeId === animeId && episode.seasonId === seasonId,
    )
    .sort((first, second) => first.episodeNumber - second.episodeNumber);
}
