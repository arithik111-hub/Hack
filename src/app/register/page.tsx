"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/animex/Icon";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      setSuccess(data.message ?? "Account created.");
      window.setTimeout(() => router.replace("/login"), 900);
    } catch {
      setError("Registration is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--register" aria-labelledby="register-title">
        <Link className="brand auth-brand" href="/" aria-label="ANIMEX home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>ANIMEX<span className="brand-period">.</span></span>
        </Link>
        <p className="eyebrow">JOIN ANIMEX</p>
        <h1 id="register-title">Create your account</h1>
        <form onSubmit={submit} noValidate>
          <label>
            Full name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={80} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={10} />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
          </label>
          <p className="auth-password-help">Use 10+ characters with uppercase, lowercase, and a number.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {success && <p className="auth-success" role="status">{success}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>
        </form>
        <p className="auth-link">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
