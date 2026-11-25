"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/animex/Icon";

export function PageNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="ANIMEX home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            ANIMEX<span className="brand-period">.</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link" href="/anime">
            Anime
          </Link>
          <Link className="nav-link" href="/genres">
            Genres
          </Link>
          <Link className="nav-link" href="/#movies">
            Movies
          </Link>
        </nav>
        <div className="nav-tools">
          <Link className="icon-button page-search-link" href="/search" aria-label="Search anime">
            <Icon name="search" size={18} />
          </Link>
          <Link className="sign-in-link" href="/login">
            Sign in
          </Link>
          <button
            className="icon-button mobile-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="page-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={21} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          className="mobile-nav-panel"
          id="page-mobile-navigation"
          aria-label="Mobile navigation"
        >
          <Link href="/" onClick={() => setMenuOpen(false)}>
            Home <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/anime" onClick={() => setMenuOpen(false)}>
            Anime <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/search" onClick={() => setMenuOpen(false)}>
            Search <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/genres" onClick={() => setMenuOpen(false)}>
            Genres <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/login" onClick={() => setMenuOpen(false)}>
            Sign in <Icon name="arrow-right" size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}
