"use client";

import BaseModal from "@/components/modals/BaseModal";
import RapidFireWordMatch from "@/components/gameplay/RapidFireWordMatch";

export default function WordQuizModal({
  isOpen,
  wordSet,
  knownWordKeys = [],
  onAddToKnown,
  showRomanization,
  onClose,
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Word Quiz"
      subtitle="Rapid-fire multiple choice using the words in this list."
      panelClassName="max-w-2xl"
      layerClassName="z-[60]"
    >
      <RapidFireWordMatch
        wordSet={wordSet}
        showRomanization={showRomanization}
        emptyMessage="You need at least 4 words with different English meanings to start this quiz."
        knownWordKeys={knownWordKeys}
        onAddToKnown={onAddToKnown}
        resetOnWordSetChange={false}
      />
    </BaseModal>
  );
}
