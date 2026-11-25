"use client";

import { useMemo, useState } from "react";
import { AnimeCard } from "@/components/animex/AnimeCard";
import { Icon } from "@/components/animex/Icon";
import { genreOptions, type Anime, type AnimeGenre } from "@/data/anime";
import { searchAnime } from "@/lib/anime/search";

type SortOrder = "popularity" | "rating" | "latest" | "alphabetical";

export default function AnimeCatalogClient({ catalog = [] as Anime[] }: { catalog?: Anime[] }) {
  const releaseYears = [...new Set(catalog.map((anime) => anime.releaseYear))]
    .sort((first, second) => second - first);
  const languages = [...new Set(catalog.flatMap((anime) => anime.languages))]
    .sort((first, second) => first.localeCompare(second));
  const catalogGenres = [...new Set([
    ...genreOptions,
    ...catalog.flatMap((anime) => anime.genres),
  ])] as AnimeGenre[];
  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<AnimeGenre[]>([]);
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [minimumRating, setMinimumRating] = useState("");
  const [type, setType] = useState("");
  const [language, setLanguage] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("popularity");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredAnime = useMemo(() => {
    const filtered = searchAnime(catalog, query).filter((anime) => {
      const matchesGenres =
        selectedGenres.length === 0 ||
        selectedGenres.some((genre) => anime.genres.includes(genre));
      const matchesYear = !year || anime.releaseYear === Number(year);
      const matchesStatus = !status || anime.status === status;
      const matchesRating =
        !minimumRating || anime.rating >= Number(minimumRating);
      const matchesType = !type || anime.type === type;
      const matchesLanguage =
        !language || anime.languages.includes(language);

      return (
        matchesGenres &&
        matchesYear &&
        matchesStatus &&
        matchesRating &&
        matchesType &&
        matchesLanguage
      );
    });

    return [...filtered].sort((first, second) => {
      switch (sortOrder) {
        case "rating":
          return second.rating - first.rating;
        case "latest":
          return second.releaseYear - first.releaseYear;
        case "alphabetical":
          return first.title.localeCompare(second.title);
        case "popularity":
          return second.popularity - first.popularity;
      }
    });
  }, [catalog, language, minimumRating, query, selectedGenres, sortOrder, status, type, year]);

  const clearFilters = () => {
    setQuery("");
    setSelectedGenres([]);
    setYear("");
    setStatus("");
    setMinimumRating("");
    setType("");
    setLanguage("");
    setSortOrder("popularity");
  };

  const toggleGenre = (genre: AnimeGenre) => {
    setSelectedGenres((current) =>
      current.includes(genre)
        ? current.filter((entry) => entry !== genre)
        : [...current, genre],
    );
  };

  return (
    <div className="catalog-layout">
      <aside
        className={`catalog-filters ${filtersOpen ? "is-open" : ""}`}
        id="anime-catalog-filters"
        aria-label="Anime catalogue filters"
      >
        <div className="catalog-filters__heading">
          <div>
            <p className="eyebrow section-eyebrow">REFINE YOUR PICKS</p>
            <h2>Filters</h2>
          </div>
          <button className="filter-reset" type="button" onClick={clearFilters}>
            Reset
          </button>
        </div>

        <fieldset className="filter-group">
          <legend>Genre</legend>
          <div className="genre-checkbox-list">
            {catalogGenres.map((genre) => (
              <label className="genre-checkbox" key={genre}>
                <input
                  type="checkbox"
                  checked={selectedGenres.includes(genre)}
                  onChange={() => toggleGenre(genre)}
                />
                <span>{genre}</span>
                <span className="genre-checkbox__count">
                  {catalog.filter((anime) => anime.genres.includes(genre)).length}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="filter-group">
          <span className="filter-group__label">Release year</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {releaseYears.map((releaseYear) => (
              <option key={releaseYear} value={releaseYear}>
                {releaseYear}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-group__label">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="Airing">Airing</option>
            <option value="Completed">Completed</option>
            <option value="Upcoming">Upcoming</option>
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-group__label">Rating</span>
          <select
            value={minimumRating}
            onChange={(event) => setMinimumRating(event.target.value)}
          >
            <option value="">Any rating</option>
            <option value="9">9.0 and above</option>
            <option value="8">8.0 and above</option>
            <option value="7">7.0 and above</option>
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-group__label">Anime type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            <option value="TV">TV series</option>
            <option value="Movie">Movie</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
          </select>
        </label>

        <label className="filter-group">
          <span className="filter-group__label">Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">All languages</option>
            {languages.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <section className="catalog-results" aria-labelledby="catalog-heading">
        <div className="catalog-results__toolbar">
          <div>
            <p className="eyebrow section-eyebrow">THE ANIMEX LIBRARY</p>
            <h2 id="catalog-heading">
              {filteredAnime.length}{" "}
              {filteredAnime.length === 1 ? "title" : "titles"}
              <span> to explore</span>
            </h2>
          </div>
          <div className="catalog-controls">
            <button
              className="catalog-filter-toggle"
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="anime-catalog-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Icon name="filter" size={17} />
              Filters
            </button>
            <label className="catalog-sort">
              <span>Sort by</span>
              <select
                aria-label="Sort anime by"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              >
                <option value="popularity">Popularity</option>
                <option value="rating">Highest rated</option>
                <option value="latest">Latest releases</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
              <Icon name="chevron-down" size={16} />
            </label>
          </div>
        </div>

        <label className="catalog-search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Search titles and genres</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, alternate name, or genre"
          />
        </label>

        {filteredAnime.length > 0 ? (
          <div className="anime-grid catalog-anime-grid">
            {filteredAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="catalog-empty" role="status">
            <span className="empty-state__icon">
              <Icon name="search" size={23} />
            </span>
            <h3>No matching anime</h3>
            <p>Try changing a filter or clearing your search.</p>
            <button
              className="button button-outline"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
