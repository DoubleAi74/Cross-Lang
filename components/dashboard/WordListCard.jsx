"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SecondaryButton from "@/components/ui/SecondaryButton";
import {
  dispatchListDeleted,
  dispatchListUpdated,
} from "@/lib/lists/browser-events";
import { cx } from "@/lib/utils";

export default function WordListCard({
  list,
  username,
  readOnly = false,
  detailHref = null,
}) {
  const router = useRouter();
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(list.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const publicPath = `/u/${username || "user"}/${list.slug}`;
  const cardHref =
    detailHref || (readOnly ? publicPath : `/dashboard/${list.slug}`);
  const canEdit = !readOnly;

  useEffect(() => {
    setDraftName(list.name);
  }, [list.name]);

  useEffect(() => {
    if (!canEdit || !isMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [canEdit, isMenuOpen]);

  async function handleRenameSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: draftName }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to rename list");
      }

      dispatchListUpdated(payload);
      setIsEditing(false);
      startTransition(() => router.refresh());
    } catch (renameError) {
      setError(renameError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsMenuOpen(false);

    if (!window.confirm(`Delete "${list.name}"? This cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to delete list");
      }

      dispatchListDeleted(list.id);
      startTransition(() => router.refresh());
      return;
    } catch (deleteError) {
      setError(deleteError.message);
      setIsSubmitting(false);
      return;
    }
  }

  function startEditing() {
    setDraftName(list.name);
    setError("");
    setIsEditing(true);
    setIsMenuOpen(false);
  }

  function cancelEditing() {
    setDraftName(list.name);
    setError("");
    setIsEditing(false);
  }

  return (
    <article className="glass-panel page-enter relative overflow-hidden border border-white/50 p-5 shadow-float">
      <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-coral/12 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            <span className="soft-pill bg-white/70 text-ink/65">Hindi</span>
            {list.source === "audio" ? (
              <span className="soft-pill bg-amber/20 text-amber/90">♪ Audio</span>
            ) : null}
            <span>{list.wordCount} words</span>
          </div>
          {isEditing ? (
            <form className="space-y-3" onSubmit={handleRenameSubmit}>
              <input
                type="text"
                value={draftName}
                maxLength={120}
                className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/35 focus:border-coral/50"
                onChange={(event) => setDraftName(event.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <PrimaryButton
                  type="submit"
                  className="px-4 py-2 text-xs"
                  disabled={isSubmitting}
                >
                  Save
                </PrimaryButton>
                <SecondaryButton
                  className="px-4 py-2 text-xs"
                  onClick={cancelEditing}
                  disabled={isSubmitting}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </form>
          ) : (
            <Link
              href={cardHref}
              className="block transition hover:-translate-y-0.5"
            >
              <h2 className="text-3xl leading-tight text-ink">{list.name}</h2>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                {list.source === "audio"
                  ? "Imported from audio with translations, playback, quizzes, and sentence generation ready."
                  : "Ready for quizzes, sentence generation, and progress tracking."}
              </p>
            </Link>
          )}
        </div>

        {canEdit ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/10 bg-white/75 text-lg text-ink transition hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white"
              aria-label={`Open actions for ${list.name}`}
              onClick={() => setIsMenuOpen((value) => !value)}
              disabled={isSubmitting}
            >
              ⋮
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-14 z-20 min-w-44 rounded-2xl border border-ink/10 bg-white/95 p-2 shadow-float">
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-mist"
                  onClick={startEditing}
                >
                  Edit name
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-coral transition hover:bg-coral/10"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="relative mt-4 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/38">
            Public path
          </p>
          <p className="mt-2 break-all text-sm text-ink/62">{publicPath}</p>
        </div>
        <p className="text-right text-xs font-medium uppercase tracking-[0.2em] text-forest/70">
          Updated {new Date(list.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </article>
  );
}
