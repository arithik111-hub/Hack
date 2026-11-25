import { genreOptions, type AnimeGenre } from "@/data/anime";

export type GenreProfile = {
  name: AnimeGenre;
  slug: string;
  description: string;
  accent: string;
};

const descriptions: Record<AnimeGenre, string> = {
  Action: "High-energy adventures, daring rivals, and unforgettable battles.",
  Adventure: "Travel to new worlds and follow characters into the unknown.",
  Comedy: "Lighthearted stories, quick wit, and characters who bring the fun.",
  Drama: "Personal journeys and emotional stories that stay with you.",
  Fantasy: "Magic, mythical worlds, and imaginative journeys beyond the ordinary.",
  Horror: "Dark mysteries and unsettling supernatural encounters.",
  Mystery: "Follow the clues and uncover the truth behind a hidden puzzle.",
  Psychological: "Mind games, tough choices, and stories that challenge perception.",
  Romance: "Relationships, heartfelt moments, and stories about connection.",
  "Slice of Life": "Warm everyday stories and personal moments with a grounded rhythm.",
  "Sci-Fi": "Future worlds, advanced technology, and big questions about humanity.",
  Sports: "Teamwork, competition, and the drive to reach a personal best.",
  Supernatural: "Spirits, strange powers, and unseen forces shape these stories.",
  Thriller: "Tense plots and unexpected turns keep every moment moving.",
};

const accents = [
  "#b45d74",
  "#6085b3",
  "#c2914b",
  "#9a6cb5",
  "#7366bc",
  "#bd684d",
  "#558f91",
  "#c875a1",
  "#6a92bc",
  "#498aa1",
  "#6b9b78",
  "#ae5960",
  "#8b74bf",
];

export const genreCatalog: GenreProfile[] = genreOptions.map((name, index) => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  description: descriptions[name],
  accent: accents[index % accents.length],
}));

export function getGenreBySlug(slug: string) {
  return genreCatalog.find((genre) => genre.slug === slug);
}
