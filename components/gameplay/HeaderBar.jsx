"use client";

import SecondaryButton from "@/components/ui/SecondaryButton";
import RomanizationToggle from "@/components/gameplay/RomanizationToggle";

export default function HeaderBar({
  wordCount,
  onBackToList,
  onOpenWordList,
  romanizationEnabled,
  onToggleRomanization,
}) {
  return (
    <div className="glass-panel rounded-b-[20px] rounded-t-none p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            key={wordCount}
            className="soft-pill count-flash flex items-end gap-2 rounded-[1.25rem] px-4 py-2"
          >
            <span className="text-2xl font-semibold leading-none text-ink sm:text-3xl">
              {wordCount}
            </span>
            <span className="pb-0.5 text-sm font-medium text-ink/70 sm:text-base">
              words
            </span>
          </div>

          <SecondaryButton className="px-4 py-2.5" onClick={onOpenWordList}>
            Word List
          </SecondaryButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {onToggleRomanization ? (
            <RomanizationToggle
              enabled={romanizationEnabled}
              onToggle={onToggleRomanization}
            />
          ) : null}
          <SecondaryButton className="px-4 py-2.5" onClick={onBackToList}>
            Back to List
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
