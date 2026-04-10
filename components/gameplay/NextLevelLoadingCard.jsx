"use client";

import LoadingSpinner from "@/components/ui/LoadingSpinner";
import RapidFireWordMatch from "@/components/gameplay/RapidFireWordMatch";
import { pluralize, titleizePendingAction, cx } from "@/lib/utils";

export default function NextLevelLoadingCard({
  pendingAction,
  pendingWordSet,
  isLoading,
  showRomanization,
}) {
  const pendingWordCount = pendingWordSet?.word_set?.length || 0;

  return (
    <section className="glass-panel rounded-[2rem] border border-ink/10 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className={cx(!isLoading && "opacity-0")}>
            <LoadingSpinner />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
              {isLoading ? "Preparing next level" : "Next level ready"}
            </p>
            <h3 className="text-2xl text-ink sm:text-3xl">
              {titleizePendingAction(pendingAction)}
            </h3>
            <p className="text-sm leading-6 text-ink/65">
              {isLoading
                ? pendingWordCount
                  ? `${pendingWordCount} ${pluralize(pendingWordCount, "word")} queued for the next round. The next level will appear right below this card.`
                  : "Validating the next deck and sentence batch now."
                : "The next level is available below. You can keep playing this word match or scroll down whenever you're ready."}
            </p>
          </div>
        </div>

        {pendingWordCount >= 4 ? (
          <RapidFireWordMatch
            wordSet={pendingWordSet}
            showRomanization={showRomanization}
          />
        ) : null}
      </div>
    </section>
  );
}
