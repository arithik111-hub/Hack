"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Icon } from "@/components/animex/Icon";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      remember,
      redirect: false,
      callbackUrl: "/",
    });
    setLoading(false);
    if (result?.ok) {
      window.location.assign(result.url ?? "/");
    } else {
      setError("Email or password is incorrect.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="brand auth-brand" href="/" aria-label="ANIMEX home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>ANIMEX<span className="brand-period">.</span></span>
        </Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Sign in to ANIMEX</h1>
        {process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true" && (
          <button
            className="button google-login-button"
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            Continue with Google
          </button>
        )}
        <div className="auth-divider"><span>or continue with email</span></div>
        <form onSubmit={submit} noValidate>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <span className="auth-password">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          <label className="auth-checkbox">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Keep me signed in</span>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>
        </form>
        <p className="auth-link">No account? <Link href="/register">Create one</Link></p>
        <button className="auth-forgot" type="button" onClick={() => alert("Password recovery is not configured yet.")}>
          Forgot password?
        </button>
      </section>
    </main>
  );
}
