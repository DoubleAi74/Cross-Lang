"use client";

import { cx } from "@/lib/utils";

const STATUS_STYLES = {
  default:
    "border-ink/10 bg-white/80 text-ink hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white",
  correct: "border-forest/25 bg-forest text-white shadow-lg shadow-forest/15",
  incorrect: "border-coral/25 bg-coral text-white shadow-lg shadow-coral/15",
  missed: "border-amber/35 bg-amber/20 text-ink",
  disabled: "border-ink/8 bg-white/55 text-ink/50",
};

export default function AnswerOptionButton({
  option,
  onSelect,
  disabled,
  status,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(option)}
      className={cx(
        "w-full rounded-[1.5rem] border px-5 py-4 text-left text-base font-semibold transition",
        STATUS_STYLES[status],
      )}
    >
      {option}
    </button>
  );
}
