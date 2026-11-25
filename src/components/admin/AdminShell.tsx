"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Icon } from "@/components/animex/Icon";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <main className={`admin-shell ${open ? "admin-shell--open" : ""}`}>
      <aside className="admin-sidebar">
        <button className="admin-mobile-close" type="button" onClick={() => setOpen(false)} aria-label="Close admin menu">
          <Icon name="close" size={18} />
        </button>
        <Link className="brand admin-brand" href="/">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>ANIMEX<span className="brand-period">.</span></span>
        </Link>
        <nav className="admin-nav" aria-label="Admin navigation">
          <Link href="/admin" onClick={() => setOpen(false)}><span>01</span>Overview</Link>
          <Link href="/admin/anime" onClick={() => setOpen(false)}><span>02</span>Anime management</Link>
          <Link href="/admin/anime/new" onClick={() => setOpen(false)}><span>03</span>Add anime</Link>
          <Link href="/admin/import" onClick={() => setOpen(false)}><span>04</span>Anime importer</Link>
          <Link href="/admin/genres" onClick={() => setOpen(false)}><span>05</span>Genres</Link>
          <Link href="/admin/seasons" onClick={() => setOpen(false)}><span>06</span>Seasons</Link>
          <Link href="/admin/episodes" onClick={() => setOpen(false)}><span>07</span>Episodes</Link>
          <Link href="/admin/video-sources" onClick={() => setOpen(false)}><span>08</span>Video sources</Link>
          <Link href="/admin/downloader" onClick={() => setOpen(false)}><span>09</span>Downloader</Link>
          <Link href="/admin/users" onClick={() => setOpen(false)}><span>10</span>Users</Link>
          <Link href="/admin/history" onClick={() => setOpen(false)}><span>11</span>Watch history</Link>
          <Link href="/admin/settings" onClick={() => setOpen(false)}><span>12</span>Settings</Link>
        </nav>
        <Link className="admin-back" href="/">Back to website</Link>
        <button className="admin-back admin-logout" type="button" onClick={() => signOut({ callbackUrl: "/" })}>Logout</button>
      </aside>
      <button className="admin-mobile-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" aria-expanded={open}>
        <Icon name="menu" size={20} />
      </button>
      <section className="admin-content">{children}</section>
    </main>
  );
}
