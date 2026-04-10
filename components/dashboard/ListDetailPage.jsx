"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import ActionCard from "@/components/dashboard/ActionCard";
import SentencePreview from "@/components/import/SentencePreview";
import AudioPlayer from "@/components/lists/AudioPlayer";
import WordListModal from "@/components/lists/WordListModal";
import WordQuizModal from "@/components/lists/WordQuizModal";
import RomanizationToggle from "@/components/gameplay/RomanizationToggle";
import SecondaryButton from "@/components/ui/SecondaryButton";
import { getKnownWordKey } from "@/lib/utils";

function applyKnownWordState(currentKeys, wordKey, shouldBeKnown) {
  if (shouldBeKnown) {
    return currentKeys.includes(wordKey)
      ? currentKeys
      : [...currentKeys, wordKey];
  }

  return currentKeys.filter((entry) => entry !== wordKey);
}

export default function ListDetailPage({ list, isOwner = true }) {
  const router = useRouter();
  const [currentWordSet, setCurrentWordSet] = useState(list.currentWordSet || []);
  const [knownWordKeys, setKnownWordKeys] = useState(list.knownWordKeys || []);
  const [showRomanization, setShowRomanization] = useState(list.showRomanization ?? true);
  const [session, setSession] = useState(list.session || null);
  const [isWordListOpen, setIsWordListOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [error, setError] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const knownWordKeysRef = useRef(knownWordKeys);
  const knownWordRequestVersionRef = useRef(new Map());
  const preferenceRequestVersionRef = useRef(0);
  const isAudioList = list.source === "audio" && Array.isArray(list.sentences);

  useEffect(() => {
    knownWordKeysRef.current = knownWordKeys;
  }, [knownWordKeys]);

  const wordSet = useMemo(
    () => ({ word_set: currentWordSet }),
    [currentWordSet],
  );
  const quizWordSet = useMemo(() => {
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
  const sessionStatus =
    session?.levelNumber > 0
      ? session.currentLevel?.isComplete
        ? `Level ${session.levelNumber} complete`
        : `Level ${session.levelNumber} in progress`
      : "Not started";

  function applyFullList(payload) {
    setCurrentWordSet(payload.currentWordSet || []);
    setKnownWordKeys(payload.knownWordKeys || []);
    setShowRomanization(payload.showRomanization ?? true);
    setSession(payload.session || null);
  }

  function updateKnownWord(word, shouldBeKnown) {
    const wordKey = getKnownWordKey(word);

    if (!wordKey) {
      return;
    }

    const requestVersion =
      (knownWordRequestVersionRef.current.get(wordKey) || 0) + 1;
    knownWordRequestVersionRef.current.set(wordKey, requestVersion);

    setKnownWordKeys((currentKeys) =>
      applyKnownWordState(currentKeys, wordKey, shouldBeKnown),
    );
    setError("");

    void (async () => {
      try {
        const response = await fetch(`/api/lists/${list.id}/known-words`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "set",
            wordKey,
            known: shouldBeKnown,
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to update known words");
        }
      } catch (toggleError) {
        if (knownWordRequestVersionRef.current.get(wordKey) !== requestVersion) {
          return;
        }

        setKnownWordKeys((currentKeys) => {
          const isStillShowingFailedState = currentKeys.includes(wordKey) === shouldBeKnown;

          if (!isStillShowingFailedState) {
            return currentKeys;
          }

          return applyKnownWordState(currentKeys, wordKey, !shouldBeKnown);
        });
        setError(toggleError.message);
      }
    })();
  }

  function toggleKnownWord(word) {
    if (!isOwner) {
      return;
    }

    const wordKey = getKnownWordKey(word);

    if (!wordKey) {
      return;
    }

    updateKnownWord(word, !knownWordKeysRef.current.includes(wordKey));
  }

  function addKnownWord(word) {
    const wordKey = getKnownWordKey(word);

    if (!wordKey || knownWordKeysRef.current.includes(wordKey)) {
      return;
    }

    updateKnownWord(word, true);
  }

  async function handleReset(options) {
    setIsResetting(true);
    setError("");

    try {
      const response = await fetch(`/api/lists/${list.id}/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to reset list");
      }

      applyFullList(payload);
      startTransition(() => router.refresh());
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setIsResetting(false);
    }
  }

  function handleToggleRomanization() {
    if (!isOwner) {
      return;
    }

    const previousValue = showRomanization;
    const nextValue = !previousValue;
    const requestVersion = preferenceRequestVersionRef.current + 1;

    preferenceRequestVersionRef.current = requestVersion;
    setShowRomanization(nextValue);
    setError("");

    void (async () => {
      try {
        const response = await fetch(`/api/lists/${list.id}/preferences`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ showRomanization: nextValue }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to update preferences");
        }
      } catch (preferenceError) {
        if (preferenceRequestVersionRef.current !== requestVersion) {
          return;
        }

        setShowRomanization(previousValue);
        setError(
          preferenceError.message ||
            "Could not save the romanization preference.",
        );
      }
    })();
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="page-enter space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.24em] text-forest/75 transition hover:text-forest"
          >
            ← Dashboard
          </Link>
          <div className="space-y-3">
            <h1 className="text-5xl leading-tight sm:text-6xl">{list.name}</h1>
            <p className="text-lg text-ink/66">
              {currentWordSet.length} words · Hindi
              {isAudioList ? " · Audio import" : ""}
            </p>
          </div>
        </div>

        {isAudioList ? (
          <section className="glass-panel border border-white/50 p-5 sm:p-6">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                        "Listen back to the imported audio while reviewing each translated line and its extracted vocabulary."}
                    </p>
                  </div>
                  {list.audioFileName ? (
                    <p className="text-sm font-medium text-ink/55">
                      Source file: {list.audioFileName}
                    </p>
                  ) : null}
                </div>

                <div className="lg:w-auto">
                  <RomanizationToggle
                    enabled={showRomanization}
                    onToggle={handleToggleRomanization}
                  />
                </div>
              </div>

              <AudioPlayer src={list.audioUrl} />

              <div className="max-h-[60vh] overflow-y-auto pr-2 sentence-scroll">
                <SentencePreview
                  sentences={list.sentences}
                  showRomanization={showRomanization}
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2">
          <ActionCard
            icon="📋"
            title="View Full List"
            subtitle="Search, scan, and mark words you already know."
            onClick={() => setIsWordListOpen(true)}
          />
          <ActionCard
            icon="⚡"
            title="Word Quiz"
            subtitle="Run a quick recognition round across this list."
            onClick={() => setIsQuizOpen(true)}
          />
          <ActionCard
            icon="▶"
            title="Sentence Generator"
            subtitle={sessionStatus}
            href={`/dashboard/${list.slug}/play`}
          />
          <ActionCard
            icon="◌"
            title="More Soon"
            subtitle="Reserved for deeper review tools and future drills."
            placeholder
          />
        </section>

        {error ? (
          <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
            {error}
          </p>
        ) : null}

        {isOwner ? (
          <section className="glass-panel border border-white/50 p-5">
            <div className="flex flex-wrap gap-3">
              <SecondaryButton
                disabled={isResetting}
                onClick={() =>
                  window.confirm("Reset all known-word marks for this list?")
                    ? handleReset({ resetKnownWords: true })
                    : null
                }
              >
                Reset known words
              </SecondaryButton>
              <SecondaryButton
                disabled={isResetting}
                onClick={() =>
                  window.confirm(
                    "Reset this word list back to its original words and clear the current session?",
                  )
                    ? handleReset({ resetWordList: true })
                    : null
                }
              >
                Reset word list
              </SecondaryButton>
            </div>
          </section>
        ) : null}
      </div>

      <WordListModal
        isOpen={isWordListOpen}
        wordSet={wordSet}
        baseWordCount={currentWordSet.length}
        knownWordKeys={knownWordKeys}
        onToggleKnownWord={toggleKnownWord}
        onAddToKnown={addKnownWord}
        showRomanization={showRomanization}
        isOwner={isOwner}
        onClose={() => setIsWordListOpen(false)}
      />

      <WordQuizModal
        isOpen={isQuizOpen}
        wordSet={quizWordSet}
        knownWordKeys={knownWordKeys}
        onAddToKnown={isOwner ? addKnownWord : null}
        showRomanization={showRomanization}
        onClose={() => setIsQuizOpen(false)}
      />
    </div>
  );
}
