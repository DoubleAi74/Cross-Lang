"use client";

import { useEffect, useState } from "react";
import WordListCard from "@/components/dashboard/WordListCard";
import {
  LIST_DELETED_EVENT,
  LIST_UPDATED_EVENT,
} from "@/lib/lists/browser-events";

function sortLists(lists) {
  return [...lists].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export default function PublicProfile({ lists, username, isOwner = false }) {
  const [items, setItems] = useState(() => sortLists(lists));

  useEffect(() => {
    setItems(sortLists(lists));
  }, [lists]);

  useEffect(() => {
    if (!isOwner) {
      return undefined;
    }

    function handleUpdated(event) {
      const nextList = event.detail?.list;

      if (!nextList?.id) {
        return;
      }

      setItems((current) =>
        sortLists(
          current.map((entry) => (entry.id === nextList.id ? nextList : entry)),
        ),
      );
    }

    function handleDeleted(event) {
      const id = event.detail?.id;

      if (!id) {
        return;
      }

      setItems((current) => current.filter((entry) => entry.id !== id));
    }

    window.addEventListener(LIST_UPDATED_EVENT, handleUpdated);
    window.addEventListener(LIST_DELETED_EVENT, handleDeleted);

    return () => {
      window.removeEventListener(LIST_UPDATED_EVENT, handleUpdated);
      window.removeEventListener(LIST_DELETED_EVENT, handleDeleted);
    };
  }, [isOwner]);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="page-enter grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-forest/75">
              Public profile
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl break-words text-5xl leading-tight sm:text-6xl">
                {username}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-ink/66">
                {isOwner
                  ? "This is your public collection. You can still rename or remove lists here, while the page stays focused on what visitors can browse."
                  : "Browse this public Cross-Lang collection, open any word list, and try the word quiz without signing in."}
              </p>
            </div>
          </div>

          {isOwner ? (
            <div className="soft-pill justify-self-start rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-forest lg:justify-self-end">
              Owner view
            </div>
          ) : null}
        </section>

        {items.length ? (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((list) => (
              <WordListCard
                key={list.id}
                list={list}
                username={username}
                readOnly={!isOwner}
                detailHref={`/u/${username}/${list.slug}`}
              />
            ))}
          </section>
        ) : (
          <section className="glass-panel page-enter border border-white/50 p-8 text-center shadow-float">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-forest/75">
              Nothing public yet
            </p>
            <h2 className="mt-3 text-4xl leading-tight text-ink">
              No word lists are available to browse.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink/65">
              {isOwner
                ? "Create a list from your dashboard and it will appear here as part of your public profile."
                : "Check back later for shared Hindi decks from this profile."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
