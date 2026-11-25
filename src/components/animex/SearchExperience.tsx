"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimeCard } from "@/components/animex/AnimeCard";
import { Icon } from "@/components/animex/Icon";
import type { Anime } from "@/data/anime";
import { searchAnime } from "@/lib/anime/search";

export function SearchExperience({ initialQuery, catalog }: { initialQuery: string; catalog: Anime[] }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const results = useMemo(() => searchAnime(catalog, query), [catalog, query]);
  const suggestions = useMemo(() => {
    const candidates = query
      ? searchAnime(catalog, query)
      : [...catalog].sort((first, second) => second.popularity - first.popularity);

    return candidates.slice(0, 5);
  }, [catalog, query]);

  const clearSearch = () => {
    setQuery("");
    setSuggestionsOpen(false);
  };

  return (
    <main className="discovery-page page-gutter search-page">
      <section className="search-intro">
        <p className="eyebrow section-eyebrow">FIND YOUR NEXT FAVORITE</p>
        <h1>
          Search <span>ANIMEX</span>
        </h1>
        <p>Search titles, alternate names, and genres across the local catalogue.</p>
      </section>

      <div className="search-box-wrap">
        <form
          className="search-page-box"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSuggestionsOpen(false);
          }}
        >
          <Icon name="search" size={22} />
          <label className="visually-hidden" htmlFor="full-anime-search">
            Search titles, alternate names, or genres
          </label>
          <input
            id="full-anime-search"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder="Try Naruto, Shingeki no Kyojin, or Fantasy"
          />
          {query && (
            <button
              className="search-clear-button"
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </form>

        {suggestionsOpen && suggestions.length > 0 && (
          <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
            <span className="search-suggestions__label">
              {query ? "MATCHING TITLES" : "POPULAR SEARCHES"}
            </span>
            {suggestions.map((anime) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={anime.id}
                onClick={() => {
                  setQuery(anime.title);
                  setSuggestionsOpen(false);
                }}
              >
                <span>{anime.title}</span>
                <span>{anime.releaseYear}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="search-results-heading">
        <div>
          <p className="eyebrow section-eyebrow">DISCOVERY RESULTS</p>
          <h2 aria-live="polite">
            {results.length} {results.length === 1 ? "result" : "results"}
            {query ? <span> for “{query}”</span> : <span> to explore</span>}
          </h2>
        </div>
        <Link className="text-link" href="/anime">
          Open full catalogue <Icon name="arrow-right" size={16} />
        </Link>
      </div>

      {results.length > 0 ? (
        <div className="anime-grid search-results-grid">
          {results.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="catalog-empty search-empty" role="status">
          <span className="empty-state__icon">
            <Icon name="search" size={24} />
          </span>
          <h3>No anime matched that search</h3>
          <p>Try a different title, alternate name, or genre.</p>
          <button className="button button-outline" type="button" onClick={clearSearch}>
            Clear search
          </button>
        </div>
      )}
    </main>
  );
}
