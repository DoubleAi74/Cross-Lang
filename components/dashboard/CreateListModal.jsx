"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import BaseModal from "@/components/modals/BaseModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SecondaryButton from "@/components/ui/SecondaryButton";
import StepperInput from "@/components/ui/StepperInput";
import { DEFAULT_WORD_COUNT, MAX_LISTS_PER_USER } from "@/lib/constants";
import {
  LIST_CREATED_EVENT,
  LIST_DELETED_EVENT,
  dispatchListCreated,
} from "@/lib/lists/browser-events";

function buildDefaultName(wordCount) {
  return `${wordCount} Hindi words`;
}

export default function CreateListModal({ initialCount = 0 }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("choice");
  const [listCount, setListCount] = useState(initialCount);
  const [wordCount, setWordCount] = useState(DEFAULT_WORD_COUNT);
  const [name, setName] = useState(buildDefaultName(DEFAULT_WORD_COUNT));
  const [isCustomName, setIsCustomName] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const suggestedName = useMemo(() => buildDefaultName(wordCount), [wordCount]);
  const isAtLimit = listCount >= MAX_LISTS_PER_USER;

  useEffect(() => {
    if (!isCustomName) {
      setName(suggestedName);
    }
  }, [isCustomName, suggestedName]);

  useEffect(() => {
    function handleCreated() {
      setListCount((current) => current + 1);
    }

    function handleDeleted() {
      setListCount((current) => Math.max(0, current - 1));
    }

    window.addEventListener(LIST_CREATED_EVENT, handleCreated);
    window.addEventListener(LIST_DELETED_EVENT, handleDeleted);

    return () => {
      window.removeEventListener(LIST_CREATED_EVENT, handleCreated);
      window.removeEventListener(LIST_DELETED_EVENT, handleDeleted);
    };
  }, []);

  function resetForm() {
    setView("choice");
    setWordCount(DEFAULT_WORD_COUNT);
    setName(buildDefaultName(DEFAULT_WORD_COUNT));
    setIsCustomName(false);
    setError("");
    setIsSubmitting(false);
  }

  function closeModal() {
    setIsOpen(false);
    resetForm();
  }

  function openModal() {
    setView("choice");
    setIsOpen(true);
  }

  function handleOpenAudioImport() {
    closeModal();
    router.push("/dashboard/import");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, wordCount }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create word list");
      }

      dispatchListCreated(payload);
      closeModal();
      startTransition(() => router.refresh());
    } catch (createError) {
      setError(createError.message);
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <PrimaryButton disabled={isAtLimit} onClick={openModal}>
          Create New +
        </PrimaryButton>
        <p className="text-right text-xs font-medium uppercase tracking-[0.22em] text-ink/45">
          {isAtLimit
            ? `Word list limit reached (${listCount}/${MAX_LISTS_PER_USER})`
            : `${listCount}/${MAX_LISTS_PER_USER} lists used`}
        </p>
      </div>

      <BaseModal
        isOpen={isOpen}
        onClose={closeModal}
        title={view === "choice" ? "Create New Word List" : "Build From Word Bank"}
        subtitle={
          view === "choice"
            ? "Choose whether you want a sampled deck from the corpus or a new list generated from uploaded audio."
            : "Pick a deck size and give it a name. The words are sampled server-side."
        }
        panelClassName="max-w-2xl"
        headerActions={
          view === "word-bank" ? (
            <SecondaryButton className="shrink-0" onClick={() => setView("choice")}>
              Back
            </SecondaryButton>
          ) : null
        }
      >
        {view === "choice" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              className="glass-panel flex min-h-52 flex-col justify-between rounded-[2rem] border border-white/55 p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_20px_45px_-28px_rgba(31,23,40,0.45)]"
              onClick={() => setView("word-bank")}
            >
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-2xl shadow-float">
                  📚
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl leading-tight text-ink">
                    From Word Bank
                  </h3>
                  <p className="text-sm leading-6 text-ink/62">
                    Sample a fresh deck from the Hindi corpus and start playing
                    right away.
                  </p>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest/75">
                Best for quick focused lists
              </p>
            </button>

            <button
              type="button"
              className="glass-panel flex min-h-52 flex-col justify-between rounded-[2rem] border border-white/55 p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_20px_45px_-28px_rgba(31,23,40,0.45)]"
              onClick={handleOpenAudioImport}
            >
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-2xl shadow-float">
                  ♪
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl leading-tight text-ink">From Audio</h3>
                  <p className="text-sm leading-6 text-ink/62">
                    Upload a Hindi song, generate line-by-line translations, and
                    save the extracted vocabulary.
                  </p>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest/75">
                Best for learning from songs
              </p>
            </button>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">Name</label>
              <input
                type="text"
                value={name}
                maxLength={120}
                className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-base font-medium text-ink placeholder:text-ink/35 focus:border-coral/50"
                onChange={(event) => {
                  const nextName = event.target.value;
                  setName(nextName);
                  setIsCustomName(nextName.trim() !== suggestedName);
                }}
                disabled={isSubmitting}
              />
            </div>

            <StepperInput
              label="Number of words"
              description="Choose how many Hindi words the sampler should include in this deck."
              value={wordCount}
              onChange={setWordCount}
              min={5}
              max={1000}
              disabled={isSubmitting}
            />

            {error ? (
              <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {isSubmitting ? (
                <div className="flex items-center gap-3 text-sm font-medium text-ink/60">
                  <LoadingSpinner />
                  <span>Sampling your new word list...</span>
                </div>
              ) : (
                <span className="text-sm text-ink/55">
                  Your starter name follows the word count until you customize it.
                </span>
              )}

              <div className="flex flex-wrap gap-3">
                <SecondaryButton onClick={closeModal} disabled={isSubmitting}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  Create List
                </PrimaryButton>
              </div>
            </div>
          </form>
        )}
      </BaseModal>
    </>
  );
}
