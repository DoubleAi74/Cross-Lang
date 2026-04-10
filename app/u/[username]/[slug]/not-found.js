import Link from "next/link";

export default function PublicListNotFound() {
  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="glass-panel page-enter border border-white/50 p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-coral/75">
            Not found
          </p>
          <h1 className="mt-4 text-4xl leading-tight text-ink sm:text-5xl">
            That public word list could not be found.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
            The shared link may be outdated, or the list is no longer available
            at this address.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-mist transition hover:bg-coral"
          >
            Back to home
          </Link>
        </section>
      </div>
    </div>
  );
}
