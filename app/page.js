import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="page-enter min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-forest/80">
            Cross-Lang
          </p>
          <h1 className="max-w-3xl text-5xl leading-tight sm:text-6xl">
            Learn Hindi through fast, sticky sentence practice.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-ink/70">
            Build personal word lists, test yourself with quick-fire vocabulary quizzes,
            and move into AI-generated ten-question sentence rounds that remember where you left off.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/login"
              className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-mist transition hover:bg-coral"
            >
              Get started
            </Link>
            <span className="soft-pill border border-ink/10 py-3 text-sm font-semibold text-ink/70">
              Hindi only for MVP
            </span>
          </div>
        </div>

        <section className="glass-panel max-w-2xl border border-white/40 p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="soft-pill rounded-[1.5rem] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                Word lists
              </p>
              <p className="mt-2 text-sm text-ink/70">
                Generate and save focused Hindi decks.
              </p>
            </div>
            <div className="soft-pill rounded-[1.5rem] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                Quick quizzes
              </p>
              <p className="mt-2 text-sm text-ink/70">
                Reinforce vocabulary in rapid rounds.
              </p>
            </div>
            <div className="soft-pill rounded-[1.5rem] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                Resume ready
              </p>
              <p className="mt-2 text-sm text-ink/70">
                Pick up the current session later.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
