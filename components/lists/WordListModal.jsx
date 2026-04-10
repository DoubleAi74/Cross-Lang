"use client";

import { useEffect, useMemo, useState } from "react";
import BaseModal from "@/components/modals/BaseModal";
import SecondaryButton from "@/components/ui/SecondaryButton";
import WordListPreview from "@/components/lists/WordListPreview";
import WordQuizModal from "@/components/lists/WordQuizModal";
import { getKnownWordKey } from "@/lib/utils";

export default function WordListModal({
  isOpen,
  wordSet,
  baseWordCount = wordSet?.word_set?.length || 0,
  knownWordKeys = [],
  onToggleKnownWord,
  onAddToKnown,
  showRomanization = true,
  isOwner = true,
  onClose,
}) {
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsQuizOpen(false);
    }
  }, [isOpen]);

  const quizWordSet = useMemo(() => {
    if (!wordSet?.word_set?.length) {
      return null;
    }

    if (!isOwner) {
      return wordSet;
    }

    const knownWordKeySet = new Set(knownWordKeys);

    return {
      word_set: wordSet.word_set.filter(
        (word) => !knownWordKeySet.has(getKnownWordKey(word)),
      ),
    };
  }, [isOwner, knownWordKeys, wordSet]);

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Current Word List"
        headerActions={
          <SecondaryButton className="shrink-0" onClick={() => setIsQuizOpen(true)}>
            Quiz
          </SecondaryButton>
        }
      >
        <WordListPreview
          wordSet={wordSet}
          baseWordCount={baseWordCount}
          knownWordKeys={knownWordKeys}
          onToggleKnownWord={onToggleKnownWord}
          isOwner={isOwner}
        />
      </BaseModal>

      <WordQuizModal
        isOpen={isQuizOpen}
        wordSet={quizWordSet}
        knownWordKeys={knownWordKeys}
        onAddToKnown={isOwner ? onAddToKnown : null}
        showRomanization={showRomanization}
        onClose={() => setIsQuizOpen(false)}
      />
    </>
  );
}
