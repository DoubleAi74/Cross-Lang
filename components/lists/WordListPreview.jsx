"use client";

import { useMemo, useState } from "react";
import { cx, getKnownWordKey } from "@/lib/utils";

export default function WordListPreview({
  wordSet,
  baseWordCount = wordSet?.word_set?.length || 0,
  knownWordKeys = [],
  onToggleKnownWord = null,
  isOwner = true,
}) {
  const [query, setQuery] = useState("");
  const knownWordKeySet = useMemo(() => new Set(knownWordKeys), [knownWordKeys]);

  if (!wordSet?.word_set?.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-ink/15 bg-white/40 px-4 py-5 text-sm text-ink/55">
        The current word list will appear here as soon as it is ready.
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredWords = wordSet.word_set.filter((word) => {
    if (!normalizedQuery) {
      return true;
    }

    return [word.dv, word.rm, word.en].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
  const knownWordCount = wordSet.word_set.filter((word) =>
    knownWordKeySet.has(getKnownWordKey(word)),
  ).length;
  const extraWordCount = wordSet.word_set.filter(
    (word) => Number(word?.rk) > baseWordCount,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[1.4rem] border border-ink/10 bg-white/80 px-4 py-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 flex-none text-ink/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16L21 21" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Hindi, romanised, or English"
          className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-ink/45"
        />
      </div>

      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
        <span>Word list</span>
        <div className="flex items-center gap-2">
          <span>
            {filteredWords.length} of {wordSet.word_set.length}
          </span>
          {extraWordCount ? (
            <span className="rounded-full bg-amber/12 px-2.5 py-1 text-[10px] tracking-[0.18em] text-amber-700">
              {extraWordCount} extra
            </span>
          ) : null}
          <span className="rounded-full bg-forest/10 px-2.5 py-1 text-[10px] tracking-[0.18em] text-forest">
            {knownWordCount} known
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white/75">
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_auto] gap-3 border-b border-ink/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/45">
          <span>Hindi</span>
          <span>Romanised</span>
          <span>English</span>
          <span className="text-right">{isOwner ? "Known" : "Status"}</span>
        </div>

        <div className="word-grid max-h-[26rem] overflow-y-auto">
          {filteredWords.length ? (
            filteredWords.map((word, index) => {
              const wordKey = getKnownWordKey(word);
              const isKnown = knownWordKeySet.has(wordKey);
              const isDisplayOnlyWord = Number(word?.rk) > baseWordCount;

              return (
                <div
                  key={`${word.dv}-${index}`}
                  className={cx(
                    "grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_auto] items-center gap-3 border-b border-ink/8 px-4 py-3 text-sm last:border-b-0 transition-colors",
                    isKnown ? "bg-forest/[0.08]" : "hover:bg-white/65",
                    isDisplayOnlyWord && "opacity-[0.78]",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 break-words font-semibold text-ink">
                      {word.dv}
                    </span>
                    {isDisplayOnlyWord ? (
                      <span className="rounded-full bg-amber/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Extra
                      </span>
                    ) : null}
                  </div>
                  <span className="min-w-0 break-words font-medium text-forest">
                    {word.rm}
                  </span>
                  <span className="min-w-0 break-words text-ink/70">
                    {word.en}
                  </span>
                  {isOwner ? (
                    <div className="group flex justify-end">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isKnown}
                        disabled={!onToggleKnownWord}
                        onClick={() => onToggleKnownWord?.(word)}
                        aria-label={`${isKnown ? "Mark as unknown" : "Mark as known"}: ${word.dv}`}
                        className={cx(
                          "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-forest/30 focus-visible:ring-offset-2",
                          isKnown
                            ? "border-forest bg-forest text-white shadow-[0_14px_28px_-18px_rgba(55,125,95,0.95)]"
                            : "border-ink/12 bg-white/90 text-ink/35 group-hover:border-forest/30 group-hover:text-forest/55",
                          onToggleKnownWord
                            ? "cursor-pointer"
                            : "cursor-default opacity-70",
                        )}
                      >
                        <span
                          className={cx(
                            "text-lg leading-none transition-all duration-200",
                            isKnown ? "scale-100 opacity-100" : "scale-90 opacity-45",
                          )}
                        >
                          {isKnown ? "✓" : " "}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <span
                        className={cx(
                          "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                          isKnown
                            ? "bg-forest/10 text-forest"
                            : "bg-white/80 text-ink/45",
                        )}
                      >
                        {isKnown ? "Known" : "Open"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-sm text-ink/55">
              No words matched that search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
