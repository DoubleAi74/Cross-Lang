"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ACCOUNT_USERNAME_UPDATED_EVENT } from "@/lib/auth/events";

export default function Navbar({ sessionUser }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(sessionUser?.username || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleUsernameSave(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/account/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || "Failed to save");
      } else {
        setSaveSuccess(true);
        window.dispatchEvent(
          new CustomEvent(ACCOUNT_USERNAME_UPDATED_EVENT, {
            detail: { username: data.username },
          }),
        );
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!sessionUser?.email) {
      return;
    }

    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sessionUser.email }),
      });
      setResetSent(true);
    } catch {
      setResetSent(false);
    }
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-white/40 bg-mist/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-2xl text-ink">
          Cross-Lang
        </Link>

        {sessionUser ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="soft-pill border border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
            >
              {sessionUser.username || sessionUser.email}
            </button>

            {open ? (
              <div className="glass-panel absolute right-0 mt-3 w-80 border border-white/50 p-5 shadow-lg">
                <form onSubmit={handleUsernameSave} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setSaveSuccess(false);
                        setSaveError("");
                      }}
                      className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-mist transition hover:bg-coral disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save username"}
                  </button>

                  {saveError ? (
                    <p className="text-sm text-coral">{saveError}</p>
                  ) : null}

                  {saveSuccess ? (
                    <p className="text-sm text-forest">Username updated.</p>
                  ) : null}
                </form>

                <div className="mt-4 border-t border-ink/10 pt-4">
                  {resetSent ? (
                    <p className="text-sm text-forest">
                      Password reset email sent.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      className="text-sm font-semibold text-ink transition hover:text-coral"
                    >
                      Send password reset email
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="mt-4 w-full rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-left text-sm font-semibold text-coral transition hover:bg-coral/15"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
