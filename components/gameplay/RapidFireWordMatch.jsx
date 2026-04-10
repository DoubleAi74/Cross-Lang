"use client";

import { useState } from "react";
import { cx, getKnownWordKey, shuffle } from "@/lib/utils";

function buildRapidFireRound(wordSet) {
  const words = wordSet?.word_set || [];
  const uniqueGlossWords = [];
  const seenGlosses = new Set();

  words.forEach((word) => {
    if (!word?.en || seenGlosses.has(word.en)) {
      return;
    }

    seenGlosses.add(word.en);
    uniqueGlossWords.push(word);
  });

  if (uniqueGlossWords.length < 4) {
    return null;
  }

  const correctWord =
    uniqueGlossWords[Math.floor(Math.random() * uniqueGlossWords.length)];
  const distractors = [];

  shuffle(uniqueGlossWords).forEach((word) => {
    if (
      word.dv === correctWord.dv ||
      word.en === correctWord.en ||
      distractors.includes(word.en)
    ) {
      return;
    }

    distractors.push(word.en);
  });

  if (distractors.length < 3) {
    return null;
  }

  return {
    prompt: correctWord.dv,
    romanized: correctWord.rm,
    correctAnswer: correctWord.en,
    word: correctWord,
    options: shuffle([correctWord.en, ...distractors.slice(0, 3)]),
  };
}

function getWordSetSignature(wordSet) {
  return (wordSet?.word_set || [])
    .map((word) => `${word.dv}|${word.en}`)
    .join("::");
}

function RapidFireWordMatchInner({
  wordSet,
  showRomanization,
  emptyMessage = "Building a quick word match from the upcoming deck...",
  knownWordKeys = [],
  onAddToKnown = null,
}) {
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(() => buildRapidFireRound(wordSet));
  const [lastResult, setLastResult] = useState(null);
  const knownWordKeySet = new Set(knownWordKeys);

  if (!round) {
    return (
      <div className="rounded-[1.7rem] border border-dashed border-ink/15 bg-white/60 px-4 py-5 text-sm text-ink/60">
        {emptyMessage}
      </div>
    );
  }

  function handleSelect(option) {
    const isCorrect = option === round.correctAnswer;

    setLastResult({
      isCorrect,
      prompt: round.prompt,
      romanized: round.romanized,
      correctAnswer: round.correctAnswer,
      word: round.word,
    });
    setScore((current) => (isCorrect ? current + 1 : Math.max(current - 1, 0)));
    setRound(buildRapidFireRound(wordSet));
  }

  const previousWordKey = lastResult ? getKnownWordKey(lastResult.word) : "";
  const canAddPreviousWord =
    Boolean(lastResult && onAddToKnown && previousWordKey) &&
    !knownWordKeySet.has(previousWordKey);

  return (
    <div className="rounded-[1.7rem] border border-ink/10 bg-white/75 p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <div />

        <div className="text-center">
          <h4 className="mt-2 text-3xl text-ink sm:text-4xl">{round.prompt}</h4>
          <p
            aria-hidden={!showRomanization}
            className={cx(
              "mt-1 text-sm font-medium",
              showRomanization ? "text-forest" : "invisible",
            )}
          >
            {round.romanized}
          </p>
        </div>

        <div
          className={cx(
            "soft-pill -mr-1 -mt-1 justify-self-end rounded-[0.95rem] px-2.5 py-1.5 text-center transition-colors duration-200",
            lastResult?.isCorrect &&
              "border-forest/30 bg-forest text-white shadow-lg shadow-forest/15",
            lastResult &&
              !lastResult.isCorrect &&
              "border-coral/30 bg-coral text-white shadow-lg shadow-coral/15",
          )}
        >
          <p
            className={cx(
              "text-[9px] font-semibold uppercase tracking-[0.2em]",
              lastResult ? "text-white/80" : "text-ink/45",
            )}
          >
            Score
          </p>
          <p
            className={cx(
              "mt-0.5 text-base font-semibold",
              lastResult ? "text-white" : "text-ink",
            )}
          >
            {score}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {round.options.map((option) => (
          <button
            key={`${round.prompt}-${option}`}
            type="button"
            onClick={() => handleSelect(option)}
            className="w-full rounded-[1.5rem] border border-ink/10 bg-white/80 px-5 py-4 text-center text-base font-semibold text-ink transition-colors hover:border-ink/20 hover:bg-white"
          >
            {option}
          </button>
        ))}
      </div>

      <div
        className={cx(
          "mt-4 rounded-[1.2rem] border px-4 py-2.5 text-sm",
          !lastResult && "border-ink/10 bg-white/55",
          lastResult?.isCorrect && "border-forest/15 bg-forest/5",
          lastResult && !lastResult.isCorrect && "border-coral/15 bg-coral/5",
        )}
      >
        <div className="flex min-h-8 items-center justify-between gap-4">
          <p
            className={cx(
              "min-w-0 overflow-x-auto whitespace-nowrap font-semibold",
              !lastResult && "text-ink/70",
              lastResult?.isCorrect && "text-forest",
              lastResult && !lastResult.isCorrect && "text-coral",
              !lastResult && "invisible",
            )}
          >
            {lastResult?.prompt || "placeholder"}
            <span className="mx-2 text-current/55">-</span>
            <span className="font-medium italic">
              {lastResult?.romanized || "placeholder"}
            </span>
            <span className="mx-2 text-current/55">-</span>
            <span>{lastResult?.correctAnswer || "placeholder"}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onAddToKnown ? (
              <button
                type="button"
                disabled={!canAddPreviousWord}
                onClick={() => canAddPreviousWord && onAddToKnown(lastResult.word)}
                className={cx(
                  "inline-flex h-7 items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
                  canAddPreviousWord &&
                    "border-forest/18 bg-forest/8 text-forest hover:border-forest/35 hover:bg-forest/14",
                  !canAddPreviousWord &&
                    "cursor-not-allowed border-ink/10 bg-white/55 text-ink/35",
                  !lastResult && "invisible",
                )}
              >
                {canAddPreviousWord ? "Add to known" : "Known"}
              </button>
            ) : null}
            <span
              className={cx(
                "text-xs font-semibold uppercase tracking-[0.18em]",
                !lastResult && "text-ink/30",
                lastResult?.isCorrect && "text-forest/35",
                lastResult && !lastResult.isCorrect && "text-coral/35",
              )}
            >
              previous
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RapidFireWordMatch({
  resetOnWordSetChange = true,
  ...props
}) {
  const resetKey = resetOnWordSetChange
    ? getWordSetSignature(props.wordSet)
    : "stable";

  return <RapidFireWordMatchInner key={resetKey} {...props} />;
}
