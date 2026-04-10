"use client";

import LoadingSpinner from "@/components/ui/LoadingSpinner";

function getDefaultMessage(stage) {
  switch (stage) {
    case "transcribing":
      return "Transcribing audio...";
    case "generating":
      return "Generating translations...";
    case "complete":
      return "Translations ready to review.";
    case "error":
      return "Processing paused because something went wrong.";
    default:
      return "Preparing your import...";
  }
}

export default function ImportProgress({ stage = "idle", progress = null }) {
  const message = progress?.message || getDefaultMessage(stage);
  const hasCounts =
    Number.isFinite(progress?.completed) &&
    Number.isFinite(progress?.total) &&
    progress.total > 0;

  return (
    <section className="glass-panel border border-white/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <LoadingSpinner />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
            <span className="soft-pill bg-white/75 text-ink/65">Processing</span>
            <span>{stage}</span>
          </div>
          <h2 className="text-3xl leading-tight text-ink">{message}</h2>
          <p className="text-sm leading-6 text-ink/62">
            The audio is handled in two passes: transcription first, then
            translation and token extraction chunk by chunk.
          </p>
        </div>

        {hasCounts ? (
          <div className="sm:ml-auto">
            <div className="soft-pill bg-white/80 text-sm font-semibold text-ink/70">
              {progress.completed}/{progress.total}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
