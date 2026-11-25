import Link from "next/link";
import { Icon } from "@/components/animex/Icon";

export default function PrivacyPage() {
  return (
    <main className="state-page">
      <article className="state-card policy-content">
        <Link className="state-back-link" href="/">
          <Icon name="arrow-left" size={16} />
          Back to ANIMEX
        </Link>
        <p className="eyebrow state-eyebrow">LAST UPDATED: NOVEMBER 2026</p>
        <h1>Privacy at ANIMEX</h1>
        <p>
          This prototype is a local anime discovery experience. It does not
          provide accounts, save a watch history, or run advertising or
          analytics services.
        </p>
        <h2>Search and preferences</h2>
        <p>
          Search and genre filters run in your browser and are not submitted to
          an ANIMEX server. They reset when you leave or reload the page.
        </p>
        <h2>Artwork and third-party services</h2>
        <p>
          Anime artwork is requested from Unsplash to display the catalog.
          Those requests go to Unsplash and are subject to its own privacy
          practices. ANIMEX does not embed third-party video players.
        </p>
        <h2>Contact</h2>
        <p>
          A support channel has not been configured for this prototype. This
          policy should be reviewed and updated before a public launch.
        </p>
      </article>
    </main>
  );
}
