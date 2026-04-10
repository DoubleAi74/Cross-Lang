"use client";

import { useState } from "react";
import {
  DEFAULT_ADJUSTMENT_COUNT,
  MAX_WORD_COUNT,
  MIN_WORD_SET_SIZE,
} from "@/lib/constants";
import { clamp } from "@/lib/utils";

function getInitialAdjustmentCount(wordCount) {
  const addMax = Math.max(MAX_WORD_COUNT - wordCount, 0);
  const removeMax = Math.max(wordCount - MIN_WORD_SET_SIZE, 0);
  return Math.min(DEFAULT_ADJUSTMENT_COUNT, Math.max(addMax, removeMax, 1));
}

function LevelTransitionCardInner({
  levelNumber,
  wordCount,
  transition = null,
  onSameWords,
  onResampleWords,
  onAddWords,
  onRemoveWords,
}) {
  const [adjustmentCount, setAdjustmentCount] = useState(
    transition?.count || getInitialAdjustmentCount(wordCount),
  );
  const addMax = Math.max(MAX_WORD_COUNT - wordCount, 0);
  const removeMax = Math.max(wordCount - MIN_WORD_SET_SIZE, 0);
  const isLocked = Boolean(transition);
  const safeAddCount = addMax > 0 ? clamp(adjustmentCount, 1, addMax) : 0;
  const safeRemoveCount = clamp(adjustmentCount, 1, Math.max(removeMax, 1));
  const adjustmentLimit = Math.max(addMax, removeMax, 1);
  const displayAddCount =
    addMax > 0 ? safeAddCount : clamp(adjustmentCount, 1, adjustmentLimit);
  const displayRemoveCount =
    removeMax > 0
      ? safeRemoveCount
      : clamp(adjustmentCount, 1, adjustmentLimit);

  function updateAdjustmentCount(nextValue) {
    if (isLocked) {
      return;
    }

    setAdjustmentCount(clamp(nextValue, 1, adjustmentLimit));
  }

  function renderTransitionButton({
    label,
    onClick,
    selected = false,
    disabled = false,
  }) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        className={`h-[4.25rem] w-full rounded-[1.5rem] border px-4 text-center text-sm font-semibold leading-5 transition-colors duration-200 ${
          selected
            ? "border-ink/35 bg-white/90 shadow-[inset_0_0_0_1px_rgba(31,23,40,0.06)]"
            : "border-ink/10 bg-white/52 text-ink hover:border-ink/24 hover:bg-white/90"
        } ${disabled && !selected ? "cursor-not-allowed opacity-55" : ""} ${disabled && selected ? "cursor-not-allowed" : ""}`.trim()}
      >
        {label}
      </button>
    );
  }

  return (
    <section className="glass-panel rounded-[2rem] border border-ink/10 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h3 className="text-2xl text-ink sm:text-3xl">
              Level {levelNumber} complete!
            </h3>
            <p className="text-sm text-ink/65">
              Choose how the next level will be generated:
            </p>
          </div>

          <div className="w-full max-w-[15rem] rounded-[1.5rem] border border-ink/10 bg-white/72 p-3 md:shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/5 text-xl font-semibold text-ink transition hover:bg-ink/10 disabled:opacity-40"
                onClick={() => updateAdjustmentCount(adjustmentCount - 1)}
                disabled={isLocked || adjustmentCount <= 1}
              >
                -
              </button>

              <input
                type="number"
                value={adjustmentCount}
                min={1}
                max={adjustmentLimit}
                inputMode="numeric"
                className="no-spinner h-11 min-w-0 flex-1 rounded-2xl border border-ink/8 bg-white/70 px-3 text-center text-lg font-semibold text-ink"
                disabled={isLocked}
                onChange={(event) =>
                  updateAdjustmentCount(
                    Number.parseInt(event.target.value, 10) || adjustmentCount,
                  )
                }
              />

              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-xl font-semibold text-white transition hover:bg-coral disabled:opacity-40"
                onClick={() => updateAdjustmentCount(adjustmentCount + 1)}
                disabled={isLocked || adjustmentCount >= adjustmentLimit}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {renderTransitionButton({
            label: "Same words, fresh sentences",
            onClick: onSameWords,
            selected: transition?.action === "same",
            disabled: isLocked,
          })}
          {renderTransitionButton({
            label: `Add ${displayAddCount} words`,
            onClick: () => onAddWords(safeAddCount),
            selected: transition?.action === "add",
            disabled: isLocked || addMax < 1,
          })}
          {renderTransitionButton({
            label: "Reshuffle word list",
            onClick: onResampleWords,
            selected: transition?.action === "resample",
            disabled: isLocked,
          })}
          {renderTransitionButton({
            label: `Remove ${displayRemoveCount} words`,
            onClick: () => onRemoveWords(safeRemoveCount),
            selected: transition?.action === "remove",
            disabled: isLocked || removeMax < 1,
          })}
        </div>
      </div>
    </section>
  );
}

export default function LevelTransitionCard(props) {
  const transitionKey = [
    props.levelNumber,
    props.wordCount,
    props.transition?.action || "idle",
    props.transition?.count || 0,
  ].join("::");

  return <LevelTransitionCardInner key={transitionKey} {...props} />;
}
