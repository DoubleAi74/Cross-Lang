"use client";

import Link from "next/link";
import { useState } from "react";

export default function PasswordResetForm({ token, email }) {
  const [inputEmail, setInputEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inputEmail }),
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Reset failed");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass-panel w-full max-w-md border border-white/50 p-8 text-center">
        <p className="mb-4 text-sm font-semibold text-forest">
          Password updated successfully.
        </p>
        <Link href="/login" className="text-sm font-semibold text-ink hover:text-coral">
          Go to login
        </Link>
      </div>
    );
  }

  if (token && email) {
    return (
      <div className="glass-panel w-full max-w-md border border-white/50 p-8">
        <h2 className="text-3xl text-ink">Set a new password</h2>
        <p className="mt-3 text-sm text-ink/65">{email}</p>
        <form onSubmit={handleConfirm} className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
          />

          {error ? <p className="text-sm text-coral">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-mist transition hover:bg-coral disabled:opacity-50"
          >
            {loading ? "Saving..." : "Update password"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel w-full max-w-md border border-white/50 p-8">
      <h2 className="text-3xl text-ink">Reset password</h2>
      <p className="mt-3 text-sm text-ink/65">
        Enter the email address tied to your Cross-Lang account.
      </p>

      {submitted ? (
        <p className="mt-6 rounded-2xl bg-forest/10 px-4 py-3 text-sm text-forest">
          If that email is registered, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleRequest} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={inputEmail}
            onChange={(event) => setInputEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
          />

          {error ? <p className="text-sm text-coral">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-mist transition hover:bg-coral disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset email"}
          </button>
        </form>
      )}
    </div>
  );
}
