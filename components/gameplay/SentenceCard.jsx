"use client";

import { cx } from "@/lib/utils";

export default function SentenceCard({
  question,
  showRomanization,
  answerRecord,
  headerControls = null,
  children,
}) {
  const cardTone = answerRecord
    ? answerRecord.isCorrect
      ? "border-forest/18 bg-forest/5"
      : "border-coral/18 bg-coral/5"
    : "border-transparent";

  return (
    <section className={cx("glass-panel rounded-[2rem] border p-6 sm:p-8", cardTone)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-4xl leading-tight text-ink sm:text-5xl">
            {question.devanagari}
          </h2>

          <div className="-mr-4 -mt-3 flex items-center gap-2">
            {headerControls}
            <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-ink/45">
              #{question.questionNumber}
            </span>
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-ink/8 bg-white/45 px-4 py-3">
          <p
            aria-hidden={!showRomanization}
            className={cx(
              "text-base font-medium leading-6 sm:text-lg",
              showRomanization ? "text-forest/80" : "invisible",
            )}
          >
            {question.romanised_hindi}
          </p>
        </div>

        {children ? (
          <>
            <div className="border-t border-ink/10" />
            <div className="space-y-4">{children}</div>
          </>
        ) : null}
      </div>
    </section>
  );
}
