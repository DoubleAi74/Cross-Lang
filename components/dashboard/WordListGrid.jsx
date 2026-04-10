"use client";

import { useEffect, useState } from "react";
import WordListCard from "@/components/dashboard/WordListCard";
import {
  LIST_CREATED_EVENT,
  LIST_DELETED_EVENT,
  LIST_UPDATED_EVENT,
} from "@/lib/lists/browser-events";

function sortLists(lists) {
  return [...lists].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export default function WordListGrid({ lists, username }) {
  const [items, setItems] = useState(() => sortLists(lists));

  useEffect(() => {
    setItems(sortLists(lists));
  }, [lists]);

  useEffect(() => {
    function handleCreated(event) {
      const nextList = event.detail?.list;

      if (!nextList?.id) {
        return;
      }

      setItems((current) =>
        sortLists([
          nextList,
          ...current.filter((entry) => entry.id !== nextList.id),
        ]),
      );
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

    window.addEventListener(LIST_CREATED_EVENT, handleCreated);
    window.addEventListener(LIST_UPDATED_EVENT, handleUpdated);
    window.addEventListener(LIST_DELETED_EVENT, handleDeleted);

    return () => {
      window.removeEventListener(LIST_CREATED_EVENT, handleCreated);
      window.removeEventListener(LIST_UPDATED_EVENT, handleUpdated);
      window.removeEventListener(LIST_DELETED_EVENT, handleDeleted);
    };
  }, []);

  if (!items.length) {
    return (
      <section className="glass-panel page-enter border border-white/50 p-8 text-center shadow-float">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-forest/75">
          Ready to begin
        </p>
        <h2 className="mt-3 text-4xl leading-tight text-ink">
          Your first word list starts here.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink/65">
          Build a Hindi deck from the corpus or import one from audio, then open
          quizzes and sentence generation from the dashboard.
        </p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((list) => (
        <WordListCard key={list.id} list={list} username={username} />
      ))}
    </section>
  );
}
