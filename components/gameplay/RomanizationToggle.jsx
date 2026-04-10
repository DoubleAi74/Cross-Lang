"use client";

import { cx } from "@/lib/utils";

export default function RomanizationToggle({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="soft-pill flex w-full items-center justify-between rounded-[1.5rem] px-4 py-3 text-left transition hover:bg-white sm:w-auto"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
          Romanization
        </p>
        <p className="text-sm font-medium text-ink/75">
          {enabled ? "Shown under each sentence" : "Hidden for extra recall"}
        </p>
      </div>

      <span
        className={cx(
          "relative ml-4 h-8 w-14 rounded-full transition",
          enabled ? "bg-forest" : "bg-ink/15",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-6 w-6 rounded-full bg-white transition",
            enabled ? "left-7" : "left-1",
          )}
        />
      </span>
    </button>
  );
}
