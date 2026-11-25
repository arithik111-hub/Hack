"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimeCard } from "@/components/animex/AnimeCard";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import {
  animeCatalog,
  genreOptions,
  type Anime,
  type AnimeGenre,
} from "@/data/anime";
import { searchAnime } from "@/lib/anime/search";

const collageAnimeSlugs = [
  "one-piece",
  "naruto",
  "demon-slayer",
  "attack-on-titan",
  "jujutsu-kaisen",
  "bleach",
  "tokyo-ghoul",
  "spy-x-family",
  "hunter-x-hunter",
  "fullmetal-alchemist-brotherhood",
];

const heroCoverPositions: Record<string, string> = {
  "attack-on-titan": "50% 24%",
  bleach: "50% 24%",
  "demon-slayer": "50% 20%",
  "eclipse-zero": "50% 38%",
  "fullmetal-alchemist-brotherhood": "50% 41%",
  "hunter-x-hunter": "50% 22%",
  "jujutsu-kaisen": "50% 70%",
  naruto: "50% 22%",
  "one-piece": "50% 22%",
  "spy-x-family": "50% 54%",
  "tokyo-ghoul": "50% 30%",
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function SearchField({
  value,
  onChange,
  onSubmit,
  inputId,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputId: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={`nav-search ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Icon name="search" size={18} />
      <label className="visually-hidden" htmlFor={inputId}>
        Search anime
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search anime..."
        autoComplete="off"
      />
      <kbd aria-hidden="true">/</kbd>
    </form>
  );
}

export default function HomeExperience({ catalog = animeCatalog }: { catalog?: Anime[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState<AnimeGenre | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const features = useMemo(
    () =>
      [...catalog]
        .sort(
          (first, second) =>
            Number(second.featured) - Number(first.featured) ||
            second.popularity - first.popularity,
        )
        .slice(0, 5),
    [catalog],
  );
  const recentlyAdded = useMemo(
    () =>
      [...catalog]
        .sort((first, second) =>
          Date.parse(second.createdAt ?? "") - Date.parse(first.createdAt ?? ""),
        )
        .slice(0, 7),
    [catalog],
  );
  const latestAnime = useMemo(
    () =>
      [...catalog]
        .sort((first, second) =>
          second.releaseYear - first.releaseYear || second.popularity - first.popularity,
        )
        .slice(0, 7),
    [catalog],
  );
  const popularAnime = useMemo(
    () => [...catalog].sort((first, second) => second.popularity - first.popularity).slice(0, 7),
    [catalog],
  );
  const topRatedAnime = useMemo(
    () => [...catalog].sort((first, second) => second.rating - first.rating).slice(0, 7),
    [catalog],
  );
  const catalogGenres = [...new Set([
    ...genreOptions,
    ...catalog.flatMap((anime) => anime.genres),
  ])] as AnimeGenre[];
  const currentFeature = features[featuredIndex % Math.max(features.length, 1)];
  const hasActiveFilter = Boolean(query.trim() || activeGenre);
  const filteredAnime = useMemo(() => {
    return searchAnime(catalog, query).filter(
      (anime) => !activeGenre || anime.genres.includes(activeGenre),
    );
  }, [activeGenre, catalog, query]);
  const visibleAnime =
    showAll || hasActiveFilter ? filteredAnime : filteredAnime.slice(0, 8);
  const collageAnime = useMemo(
    () =>
      collageAnimeSlugs
        .map((slug) => catalog.find((anime) => anime.slug === slug))
        .filter((anime): anime is Anime => Boolean(anime)),
    [catalog],
  );

  const selectGenre = (genre: AnimeGenre | null) => {
    setActiveGenre((current) => (current === genre ? null : genre));
    setShowAll(true);
    document.getElementById("trending")?.scrollIntoView({ behavior: "smooth" });
  };

  const goToFeature = (direction: -1 | 1) => {
    setFeaturedIndex(
      (current) =>
        (current + direction + Math.max(features.length, 1)) % Math.max(features.length, 1),
    );
  };

  const openSearchPage = () => {
    const searchTerm = query.trim();
    router.push(
      searchTerm ? `/search?q=${encodeURIComponent(searchTerm)}` : "/search",
    );
  };

  if (!currentFeature) {
    return (
      <main className="state-page">
        <section className="state-card">
          <p className="eyebrow state-eyebrow">ANIMEX CATALOGUE</p>
          <h1>No published anime yet</h1>
          <p>Imported titles appear here after they are published from the admin catalogue.</p>
          <Link className="button button-outline" href="/admin/import">Open anime importer</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="site-header">
        <div className="nav-shell">
          <Link className="brand" href="/" aria-label="ANIMEX home">
            <BrandMark />
            <span>
              ANIMEX<span className="brand-period">.</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            <Link className="nav-link nav-link--active" href="/">
              Home
            </Link>
            <Link className="nav-link" href="/anime">
              Anime
            </Link>
            <a className="nav-link" href="#movies">
              Movies
            </a>
            <Link className="nav-link" href="/genres">
              Genres
            </Link>
          </nav>

          <div className="nav-tools">
            <SearchField
              value={query}
              onChange={setQuery}
              onSubmit={openSearchPage}
              inputId="anime-search-desktop"
            />
            <Link className="sign-in-link" href="/login">
              Sign in
            </Link>
            <button
              className="icon-button mobile-search-toggle"
              type="button"
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
              aria-expanded={mobileSearchOpen}
              onClick={() => setMobileSearchOpen((open) => !open)}
            >
              <Icon name={mobileSearchOpen ? "close" : "search"} size={20} />
            </button>
            <button
              className="icon-button mobile-menu-toggle"
              type="button"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? "close" : "menu"} size={21} />
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="mobile-search-row">
            <SearchField
              value={query}
              onChange={setQuery}
              onSubmit={openSearchPage}
              inputId="anime-search-mobile"
            />
          </div>
        )}

        {menuOpen && (
          <nav
            className="mobile-nav-panel"
            id="mobile-navigation"
            aria-label="Mobile navigation"
          >
            <Link href="/anime" onClick={() => setMenuOpen(false)}>
              Anime <Icon name="arrow-right" size={16} />
            </Link>
            <a href="#movies" onClick={() => setMenuOpen(false)}>
              Movies <Icon name="arrow-right" size={16} />
            </a>
            <Link href="/genres" onClick={() => setMenuOpen(false)}>
              Genres <Icon name="arrow-right" size={16} />
            </Link>
            <Link href="/search" onClick={() => setMenuOpen(false)}>
              Search <Icon name="arrow-right" size={16} />
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)}>
              Sign in <Icon name="arrow-right" size={16} />
            </Link>
          </nav>
        )}
      </header>

      <section className="hero-section" aria-label="Featured anime">
        <div className="hero-frame">
          <AnimeArtwork
            key={currentFeature.id}
            src={currentFeature.poster}
            alt={`${currentFeature.title} cover artwork`}
            title={currentFeature.title}
            accent={currentFeature.accent}
            sizes="100vw"
            objectPosition={heroCoverPositions[currentFeature.slug] ?? "50% 38%"}
            priority
            className="hero-artwork"
          />
          <div className="hero-vignette" aria-hidden="true" />
          <div className="hero-content page-gutter">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow">
                <span className="live-dot" />
                <span>FEATURED THIS WEEK</span>
              </div>
              <h1>{currentFeature.title}</h1>
              <div className="hero-meta">
                <span className="rating-pill">
                  <Icon name="star" size={14} />
                  {currentFeature.rating.toFixed(1)}
                </span>
                <span>{currentFeature.releaseYear}</span>
                <span className="meta-dot" aria-hidden="true" />
                <span>{currentFeature.type}</span>
                {currentFeature.totalEpisodes !== null && (
                  <>
                    <span className="meta-dot" aria-hidden="true" />
                    <span>
                      {currentFeature.totalEpisodes.toLocaleString()} episodes
                    </span>
                  </>
                )}
              </div>
              <p className="hero-description">{currentFeature.description}</p>
              <div className="hero-tags" aria-label="Genres">
                {currentFeature.genres.map((genre) => (
                  <button
                    className="hero-tag"
                    key={genre}
                    type="button"
                    onClick={() => selectGenre(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              <div className="hero-actions">
                <Link
                  className="button button-primary"
                  href={`/watch/${currentFeature.slug}`}
                >
                  <Icon name="play" size={18} />
                  Watch now
                </Link>
                <Link
                  className="button button-glass"
                  href={`/anime/${currentFeature.slug}`}
                >
                  More details
                  <Icon name="arrow-right" size={17} />
                </Link>
              </div>
            </div>

            <div className="hero-bottom">
              <a className="scroll-cue" href="#trending">
                <span className="scroll-cue__line" />
                <span>SCROLL TO EXPLORE</span>
              </a>
              <div className="hero-carousel" aria-label="Featured selection">
                <span className="hero-carousel__count">
                  0{(featuredIndex % features.length) + 1}
                  <span>/</span>
                  0{features.length}
                </span>
                <div className="hero-carousel__dots">
                  {features.map((anime, index) => (
                    <button
                      type="button"
                      key={anime.id}
                      className={`carousel-dot ${featuredIndex === index ? "is-active" : ""}`}
                      aria-label={`Show ${anime.title}`}
                      aria-pressed={featuredIndex === index}
                      onClick={() => setFeaturedIndex(index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="carousel-arrow"
                  onClick={() => goToFeature(-1)}
                  aria-label="Previous featured anime"
                >
                  <Icon name="arrow-left" size={17} />
                </button>
                <button
                  type="button"
                  className="carousel-arrow"
                  onClick={() => goToFeature(1)}
                  aria-label="Next featured anime"
                >
                  <Icon name="arrow-right" size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="hero-side-note" aria-hidden="true">
            <span>01</span>
            <span className="hero-side-note__rule" />
            <span>ANIMEX PICKS</span>
          </div>
        </div>
      </section>

      <div className="page-gutter">
        <section className="quick-stats" aria-label="ANIMEX highlights">
          <div className="quick-stat">
            <span className="quick-stat__icon">
              <Icon name="sparkles" size={18} />
            </span>
            <span>
              <strong>{catalog.length}</strong>
              <small>hand-picked titles</small>
            </span>
          </div>
          <span className="quick-stats__divider" aria-hidden="true" />
          <div className="quick-stat">
            <span className="quick-stat__icon">
              <Icon name="tv" size={18} />
            </span>
            <span>
              <strong>Fresh weekly</strong>
              <small>new episodes to discover</small>
            </span>
          </div>
          <span className="quick-stats__divider" aria-hidden="true" />
          <div className="quick-stat quick-stat--note">
            <span className="quick-stat__icon">
              <Icon name="check" size={18} />
            </span>
            <span>
              <strong>Curated for you</strong>
              <small>find your next favorite</small>
            </span>
          </div>
        </section>

        {collageAnime.length > 0 && (
          <section className="content-section" id="collage-anime">
            <div className="section-heading">
              <div>
                <p className="eyebrow section-eyebrow">FEATURED COLLECTION</p>
                <h2>
                  Anime <span>favorites</span>
                </h2>
                <p className="section-description">
                  Explore each series with its own cover artwork.
                </p>
              </div>
              <Link className="text-link section-heading__link" href="/anime">
                View all anime <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className="anime-grid">
              {collageAnime.map((anime, index) => (
                <AnimeCard key={anime.id} anime={anime} rank={index + 1} />
              ))}
            </div>
          </section>
        )}

        {recentlyAdded.length > 0 && (
          <section className="content-section popular-section" id="recently-added">
            <div className="section-heading">
              <div>
                <p className="eyebrow section-eyebrow">NEW TO ANIMEX</p>
                <h2>Recently <span>added</span></h2>
                <p className="section-description">Freshly published additions to the catalogue.</p>
              </div>
              <Link className="text-link section-heading__link" href="/anime">
                View catalogue <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className="popular-rail">
              {recentlyAdded.map((anime, index) => (
                <AnimeCard anime={anime} key={anime.id} rank={index + 1} />
              ))}
            </div>
          </section>
        )}

        <section className="content-section" id="trending">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">THE COMMUNITY IS WATCHING</p>
              <h2>
                Trending <span>right now</span>
              </h2>
              <p className="section-description">
                The stories everyone&apos;s talking about, all in one place.
              </p>
            </div>
            <a className="text-link section-heading__link" href="#popular">
              Explore popular <Icon name="arrow-right" size={16} />
            </a>
          </div>

          <div className="discovery-toolbar">
            <div className="filter-pills" aria-label="Filter by genre">
              <button
                className={`filter-pill ${activeGenre === null ? "is-active" : ""}`}
                type="button"
                aria-pressed={activeGenre === null}
                onClick={() => {
                  setActiveGenre(null);
                  setShowAll(false);
                }}
              >
                <Icon name="grid" size={14} />
                All anime
              </button>
              {catalogGenres.slice(0, 5).map((genre) => (
                <button
                  className={`filter-pill ${activeGenre === genre ? "is-active" : ""}`}
                  type="button"
                  key={genre}
                  aria-pressed={activeGenre === genre}
                  onClick={() => {
                    setActiveGenre(activeGenre === genre ? null : genre);
                    setShowAll(true);
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
            <p className="results-count" aria-live="polite">
              <Icon name="filter" size={15} />
              <strong>{filteredAnime.length}</strong>
              <span>{filteredAnime.length === 1 ? "title" : "titles"}</span>
            </p>
          </div>

          {visibleAnime.length > 0 ? (
            <div className="anime-grid">
              {visibleAnime.map((anime, index) => (
                <AnimeCard key={anime.id} anime={anime} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="empty-state" role="status">
              <span className="empty-state__icon">
                <Icon name="search" size={24} />
              </span>
              <h3>No anime found</h3>
              <p>Try a different title or clear your filters.</p>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveGenre(null);
                  setShowAll(false);
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {!hasActiveFilter && filteredAnime.length > 8 && (
            <button
              className="button button-outline load-more"
              type="button"
              onClick={() => setShowAll((showing) => !showing)}
            >
              {showAll ? "Show less" : "View all anime"}
              <Icon name={showAll ? "arrow-down" : "arrow-right"} size={16} />
            </button>
          )}
        </section>

        <section className="content-section popular-section" id="latest">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">RECENT RELEASES</p>
              <h2>Latest <span>anime</span></h2>
              <p className="section-description">Explore the newest releases in the catalogue.</p>
            </div>
          </div>
          <div className="popular-rail">
            {latestAnime.map((anime, index) => (
              <AnimeCard anime={anime} key={anime.id} rank={index + 1} />
            ))}
          </div>
        </section>

        <section className="content-section popular-section" id="popular">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">FAN FAVORITES</p>
              <h2>
                Popular <span>anime</span>
              </h2>
              <p className="section-description">
                Discover the titles drawing the most interest.
              </p>
            </div>
            <a className="text-link section-heading__link" href="#top-rated">
              Top rated <Icon name="arrow-right" size={16} />
            </a>
          </div>
          <div className="popular-rail">
            {popularAnime.map((anime, index) => (
              <AnimeCard anime={anime} key={anime.id} rank={index + 1} />
            ))}
          </div>
        </section>

        <section className="content-section popular-section" id="top-rated">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">HIGHEST SCORES</p>
              <h2>Top <span>rated</span></h2>
              <p className="section-description">The highest-rated titles, ready for your next marathon.</p>
            </div>
            <a className="text-link section-heading__link" href="#genres">
              Find your genre <Icon name="arrow-right" size={16} />
            </a>
          </div>
          <div className="popular-rail">
            {topRatedAnime.map((anime, index) => (
              <AnimeCard anime={anime} key={anime.id} rank={index + 1} />
            ))}
          </div>
        </section>

        <section className="content-section movie-section" id="movies">
          <div className="movie-section__intro">
            <div>
              <p className="eyebrow section-eyebrow">A LITTLE CINEMA MAGIC</p>
              <h2>
                Anime <span>movies</span>
              </h2>
              <p className="section-description">
                Beautifully told stories for your next movie night.
              </p>
            </div>
            <span className="movie-section__badge">
              <Icon name="sparkles" size={15} />
              FEATURED FILMS
            </span>
          </div>
          <div className="movie-grid">
            {catalog
              .filter((anime) => anime.type === "Movie")
              .map((anime) => (
                <article className="movie-card" key={anime.id}>
                  <AnimeArtwork
                    src={anime.banner}
                    alt={`${anime.title} film artwork`}
                    title={anime.title}
                    accent={anime.accent}
                    sizes="(max-width: 700px) 90vw, 33vw"
                    className="movie-card__art"
                  />
                  <div className="movie-card__overlay">
                    <div className="movie-card__rating">
                      <Icon name="star" size={13} />
                      {anime.rating.toFixed(1)}
                      <span>{anime.releaseYear}</span>
                    </div>
                    <h3>{anime.title}</h3>
                    <p>{anime.description}</p>
                    <Link
                      className="movie-card__link"
                      href={`/anime/${anime.slug}`}
                    >
                      Explore film <Icon name="arrow-right" size={15} />
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        </section>

        <section className="content-section genres-section" id="genres">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">PICK YOUR MOOD</p>
              <h2>
                Explore by <span>genre</span>
              </h2>
              <p className="section-description">
                A whole new world is just one click away.
              </p>
            </div>
            {activeGenre && (
              <button
                type="button"
                className="text-link clear-genre"
                onClick={() => selectGenre(null)}
              >
                Clear {activeGenre} filter <Icon name="close" size={15} />
              </button>
            )}
          </div>
          <div className="genre-grid">
            {catalogGenres.slice(0, 8).map((genre, index) => {
              const genreCount = catalog.filter((anime) =>
                anime.genres.includes(genre),
              ).length;
              return (
                <button
                  type="button"
                  className={`genre-tile genre-tile--${index + 1} ${activeGenre === genre ? "is-selected" : ""}`}
                  key={genre}
                  aria-pressed={activeGenre === genre}
                  onClick={() => selectGenre(genre)}
                >
                  <span className="genre-tile__count">
                    {String(genreCount).padStart(2, "0")} TITLES
                  </span>
                  <span className="genre-tile__title">{genre}</span>
                  <span className="genre-tile__arrow">
                    <Icon name="arrow-right" size={17} />
                  </span>
                  <span className="genre-tile__orb" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="future-note" aria-label="Streaming availability">
          <span className="future-note__icon">
            <Icon name="tv" size={20} />
          </span>
          <div>
            <strong>Discover now. Stream with authorized providers soon.</strong>
            <p>
              ANIMEX is a discovery experience. Video playback will be added
              only through verified, authorized providers.
            </p>
          </div>
          <Icon name="arrow-right" size={18} className="future-note__arrow" />
        </section>
      </div>

      <footer className="site-footer" id="about">
        <div className="page-gutter">
          <div className="footer-main">
            <div className="footer-brand-block">
              <Link className="brand" href="/" aria-label="ANIMEX home">
                <BrandMark />
                <span>
                  ANIMEX<span className="brand-period">.</span>
                </span>
              </Link>
              <p>
                Find the stories that stay with you. A quieter, better way to
                discover your next favorite anime.
              </p>
              <Link className="footer-mail" href="/contact">
                Contact channel coming soon
              </Link>
            </div>
            <div className="footer-links-group">
              <h3>Explore</h3>
              <a href="#trending">Trending anime</a>
              <a href="#movies">Anime movies</a>
              <a href="#genres">Genres</a>
            </div>
            <div className="footer-links-group">
              <h3>ANIMEX</h3>
              <a href="#about">About us</a>
              <Link href="/contact">Contact</Link>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms of service</Link>
            </div>
            <div className="footer-signup">
              <span className="footer-signup__label">A NOTE FOR ANIME FANS</span>
              <h3>Stories worth staying up for.</h3>
              <p>
                A thoughtfully curated guide to what to watch next. No
                unauthorized streams, just good recommendations.
              </p>
              <a className="text-link" href="#trending">
                Start exploring <Icon name="arrow-right" size={16} />
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© ANIMEX. All rights reserved.</span>
            <span className="footer-bottom__note">
              Made for the love of anime <span aria-hidden="true">✦</span>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
