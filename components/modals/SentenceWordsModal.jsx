"use client";

import BaseModal from "@/components/modals/BaseModal";
import {
  buildAllowedHindiTokenMap,
  extractHindiTokens,
  normalizeHindiToken,
} from "@/lib/hindi/tokens";
import { transliterateHindiToken } from "@/lib/hindi/transliteration";

function buildSentenceWordEntries(
  sentence,
  wordSet,
  baseWordCount = wordSet?.word_set?.length || 0,
) {
  if (!sentence?.dv) {
    return [];
  }

  const words = wordSet?.word_set || [];
  const exactWordMap = new Map();
  const allowedTokenMap = buildAllowedHindiTokenMap(wordSet);
  const seen = new Set();

  words.forEach((word) => {
    const normalizedToken = normalizeHindiToken(word?.dv);

    if (!normalizedToken || exactWordMap.has(normalizedToken)) {
      return;
    }

    exactWordMap.set(normalizedToken, word);
  });

  return extractHindiTokens(sentence.dv)
    .map((token) => normalizeHindiToken(token))
    .filter((token) => token && !seen.has(token) && seen.add(token))
    .map((token) => {
      const exactWord = exactWordMap.get(token);

      return {
        dv: token,
        rm: exactWord?.rm || transliterateHindiToken(token),
        en: exactWord?.en || allowedTokenMap.get(token) || "",
        isDisplayOnly: Number(exactWord?.rk) > baseWordCount,
      };
    });
}

export default function SentenceWordsModal({
  isOpen,
  sentence,
  wordSet,
  baseWordCount,
  onClose,
}) {
  const wordEntries = buildSentenceWordEntries(sentence, wordSet, baseWordCount);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-xl"
      showHeader={false}
    >
      <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white/75">
        <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.95fr)] gap-3 border-b border-ink/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/45">
          <span>Hindi</span>
          <span>Romanised</span>
          <span>English</span>
        </div>

        <div className="max-h-[20rem] overflow-y-auto">
          {wordEntries.length ? (
            wordEntries.map((word, index) => (
              <div
                key={`${word.dv}-${index}`}
                className={`grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.95fr)] gap-3 border-b border-ink/8 px-4 py-3 text-sm last:border-b-0 ${word.isDisplayOnly ? "opacity-[0.78]" : ""}`.trim()}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words font-semibold text-ink">
                    {word.dv}
                  </span>
                  {word.isDisplayOnly ? (
                    <span className="rounded-full bg-amber/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Extra
                    </span>
                  ) : null}
                </div>
                <span className="min-w-0 break-words font-medium text-forest">
                  {word.rm}
                </span>
                <span className="min-w-0 break-words text-ink/70">
                  {word.en || "—"}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-ink/55">
              No word details are available for this sentence.
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
