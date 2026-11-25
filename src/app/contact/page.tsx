import Link from "next/link";
import { Icon } from "@/components/animex/Icon";

export default function ContactPage() {
  return (
    <main className="state-page">
      <section className="state-card state-card--message">
        <span className="quick-stat__icon">
          <Icon name="sparkles" size={20} />
        </span>
        <p className="eyebrow state-eyebrow">SAY HELLO</p>
        <h1>Contact is coming soon.</h1>
        <p>
          No support inbox is connected to this prototype yet. We will add a
          contact channel before launch.
        </p>
        <div className="state-card__actions">
          <Link className="button button-primary" href="/">
            Back to discovery
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
