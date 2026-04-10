"use client";

import { cx } from "@/lib/utils";
import AnswerOptionButton from "@/components/gameplay/AnswerOptionButton";

function resolveStatus(
  option,
  question,
  answerRecord,
  interactionDisabled = false,
) {
  if (!answerRecord && interactionDisabled) {
    return "disabled";
  }

  if (!answerRecord) {
    return "default";
  }

  if (option === question.correctAnswer) {
    return answerRecord.isCorrect ? "correct" : "missed";
  }

  if (option === answerRecord.selectedOption && !answerRecord.isCorrect) {
    return "incorrect";
  }

  return "disabled";
}

export default function AnswerOptionsList({
  question,
  answerRecord,
  onSelect,
  interactionDisabled = false,
  isRevealed = true,
  onReveal,
}) {
  const isMasked = !isRevealed && !answerRecord;

  return (
    <div className="relative">
      <div
        className={cx(
          "grid gap-3 transition duration-200",
          isMasked && "pointer-events-none select-none blur-[6px]",
        )}
      >
        {question.options.map((option) => (
          <AnswerOptionButton
            key={option}
            option={option}
            status={resolveStatus(option, question, answerRecord, interactionDisabled)}
            disabled={interactionDisabled || Boolean(answerRecord)}
            onSelect={onSelect}
          />
        ))}
      </div>

      {isMasked ? (
        <button
          type="button"
          className="absolute inset-0 flex items-start justify-end rounded-[1.7rem] bg-white/20 p-[35px] backdrop-blur-[1px]"
          onClick={onReveal}
        >
          <span className="rounded-full border border-ink/10 bg-white/85 px-4 py-2 text-sm font-semibold text-ink shadow-float">
            Click to Reveal
          </span>
        </button>
      ) : null}
    </div>
  );
}
