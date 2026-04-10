"use client";

import { cx } from "@/lib/utils";

export default function SentencePreview({
  sentences = [],
  showRomanization = true,
  className = "",
}) {
  if (!sentences.length) {
    return null;
  }

  return (
    <div className={cx("space-y-4", className)}>
      {sentences.map((sentence, index) => (
        <article
          key={sentence.id || `${sentence.devanagari}-${index}`}
          className="glass-panel animate-float-up rounded-[2rem] border border-white/55 p-5 sm:p-6"
          style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="soft-pill bg-white/80 text-xs font-semibold uppercase tracking-[0.22em] text-ink/55">
                Sentence {sentence.id || index + 1}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-forest/75">
                {sentence.tokens?.length || 0} tokens
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-2xl leading-tight text-ink sm:text-3xl">
                {sentence.devanagari}
              </p>
              {showRomanization ? (
                <p className="text-base font-medium text-forest/80 sm:text-lg">
                  {sentence.transliteration}
                </p>
              ) : null}
              <p className="text-base leading-7 text-ink/68 sm:text-lg">
                {sentence.english}
              </p>
            </div>

            {sentence.tokens?.length ? (
              <div className="flex flex-wrap gap-3">
                {sentence.tokens.map((token, tokenIndex) => (
                  <div
                    key={`${token.word}-${tokenIndex}`}
                    className="min-w-36 flex-1 rounded-[1.4rem] border border-ink/8 bg-white/72 p-3"
                  >
                    <p className="text-lg font-semibold text-ink">{token.word}</p>
                    {showRomanization ? (
                      <p className="mt-1 text-sm font-medium text-forest/78">
                        {token.transliteration}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6 text-ink/62">
                      {token.meaning}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
