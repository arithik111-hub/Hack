"use client";

import { useState } from "react";

export function ProfileForm({ name, image }: { name: string; image: string | null }) {
  const [displayName, setDisplayName] = useState(name);
  const [profileImage, setProfileImage] = useState(image ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: displayName, image: profileImage }),
    });
    const data = (await response.json()) as { error?: string; success?: boolean };
    setLoading(false);
    setMessage(response.ok ? "Profile updated." : data.error ?? "Profile update failed.");
  }

  return (
    <form onSubmit={submit} className="profile-edit-form">
      <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required /></label>
      <label>Profile image URL<input type="url" value={profileImage} onChange={(event) => setProfileImage(event.target.value)} placeholder="https://..." /></label>
      <p className="auth-password-help">Only name and profile image can be changed. Your role cannot be changed.</p>
      {message && <p role="status" className={message === "Profile updated." ? "auth-success" : "auth-error"}>{message}</p>}
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Saving..." : "Save account settings"}</button>
    </form>
  );
}
