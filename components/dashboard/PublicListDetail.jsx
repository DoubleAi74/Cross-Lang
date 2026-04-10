"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ActionCard from "@/components/dashboard/ActionCard";
import SentencePreview from "@/components/import/SentencePreview";
import AudioPlayer from "@/components/lists/AudioPlayer";
import WordListModal from "@/components/lists/WordListModal";
import WordQuizModal from "@/components/lists/WordQuizModal";

export default function PublicListDetail({ list, username }) {
  const [isWordListOpen, setIsWordListOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const wordSet = useMemo(
    () => ({ word_set: list.currentWordSet || [] }),
    [list.currentWordSet],
  );
  const isAudioList = list.source === "audio" && Array.isArray(list.sentences);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="page-enter space-y-4">
          <Link
            href={`/u/${username}`}
            className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.24em] text-forest/75 transition hover:text-forest"
          >
            ← {username}
          </Link>
          <div className="space-y-3">
            <h1 className="text-5xl leading-tight sm:text-6xl">{list.name}</h1>
            <p className="text-lg text-ink/66">
              {list.currentWordSet.length} words · Hindi
              {isAudioList ? " · Audio import" : ""}
            </p>
          </div>
        </div>

        {isAudioList ? (
          <section className="glass-panel border border-white/50 p-5 sm:p-6">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                  <span className="soft-pill bg-white/75 text-ink/65">
                    Audio translation
                  </span>
                  {list.storyMetadata?.level ? (
                    <span>{list.storyMetadata.level}</span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl leading-tight text-ink sm:text-4xl">
                    {list.storyMetadata?.title?.devanagari ||
                      "Line-by-line Hindi review"}
                  </h2>
                  <p className="max-w-3xl text-base leading-7 text-ink/65">
                    {list.storyMetadata?.title?.english ||
                      "Listen to the imported audio and browse the translated lines in read-only mode."}
                  </p>
                </div>
                {list.audioFileName ? (
                  <p className="text-sm font-medium text-ink/55">
                    Source file: {list.audioFileName}
                  </p>
                ) : null}
              </div>

              <AudioPlayer src={list.audioUrl} />

              <div className="max-h-[60vh] overflow-y-auto pr-2 sentence-scroll">
                <SentencePreview sentences={list.sentences} showRomanization />
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            icon="📋"
            title="View Full List"
            subtitle="Browse the full Hindi deck in a read-only table."
            onClick={() => setIsWordListOpen(true)}
          />
          <ActionCard
            icon="⚡"
            title="Word Quiz"
            subtitle="Play a recognition round without changing the owner's progress."
            onClick={() => setIsQuizOpen(true)}
          />
          <ActionCard
            icon="◌"
            title="Owner Tools"
            subtitle="Sentence generation and progress controls stay private to the list owner."
            placeholder
          />
        </section>
      </div>

      <WordListModal
        isOpen={isWordListOpen}
        wordSet={wordSet}
        baseWordCount={list.currentWordSet.length}
        knownWordKeys={[]}
        onToggleKnownWord={null}
        onAddToKnown={null}
        showRomanization
        isOwner={false}
        onClose={() => setIsWordListOpen(false)}
      />

      <WordQuizModal
        isOpen={isQuizOpen}
        wordSet={wordSet}
        knownWordKeys={[]}
        onAddToKnown={null}
        showRomanization
        onClose={() => setIsQuizOpen(false)}
      />
    </div>
  );
}
