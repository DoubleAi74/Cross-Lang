"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-ink text-mist"
          : "bg-white/65 text-ink hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function LoginForm({ callbackUrl }) {
  const [tab, setTab] = useState("login");
  const [loginMode, setLoginMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const redirectTo = callbackUrl || "/dashboard";

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (loginMode === "magic") {
        await signIn("resend", { email, redirect: false });
        setMagicSent(true);
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password");
        } else {
          window.location.href = redirectTo;
        }
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Registered, but auto-login failed. Please log in.");
      } else {
        window.location.href = redirectTo;
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel w-full max-w-md border border-white/50 p-8">
      <div className="mb-6 flex gap-3">
        <TabButton
          active={tab === "login"}
          onClick={() => {
            setTab("login");
            setError("");
          }}
        >
          Log in
        </TabButton>
        <TabButton
          active={tab === "signup"}
          onClick={() => {
            setTab("signup");
            setError("");
          }}
        >
          Sign up
        </TabButton>
      </div>

      {tab === "login" ? (
        <div className="space-y-5">
          <div className="flex gap-3">
            <TabButton
              active={loginMode === "password"}
              onClick={() => {
                setLoginMode("password");
                setMagicSent(false);
                setError("");
              }}
            >
              Password
            </TabButton>
            <TabButton
              active={loginMode === "magic"}
              onClick={() => {
                setLoginMode("magic");
                setError("");
              }}
            >
              Magic link
            </TabButton>
          </div>

          {magicSent ? (
            <p className="rounded-2xl bg-forest/10 px-4 py-3 text-sm text-forest">
              Check your email for a sign-in link.
            </p>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
              />

              {loginMode === "password" ? (
                <>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
                  />
                  <div className="text-right">
                    <Link
                      href="/reset-password"
                      className="text-sm font-semibold text-forest transition hover:text-coral"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </>
              ) : null}

              {error ? <p className="text-sm text-coral">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-mist transition hover:bg-coral disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : loginMode === "magic"
                    ? "Send magic link"
                    : "Log in"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
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
            {loading ? "Loading..." : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
