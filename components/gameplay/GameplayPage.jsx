"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AnswerOptionsList from "@/components/gameplay/AnswerOptionsList";
import HeaderBar from "@/components/gameplay/HeaderBar";
import LevelTransitionCard from "@/components/gameplay/LevelTransitionCard";
import NextLevelLoadingCard from "@/components/gameplay/NextLevelLoadingCard";
import SentenceCard from "@/components/gameplay/SentenceCard";
import SentenceWordsModal from "@/components/modals/SentenceWordsModal";
import WordListModal from "@/components/lists/WordListModal";
import WordListPreview from "@/components/lists/WordListPreview";
import SecondaryButton from "@/components/ui/SecondaryButton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { PENDING_ACTIONS } from "@/lib/constants";
import { serializeError } from "@/lib/errors";
import { buildQuestionOptions, completeLevel, submitAnswer } from "@/lib/game";
import { consumeSseStream } from "@/lib/sse";
import { cx, getKnownWordKey, pluralize, titleizePendingAction } from "@/lib/utils";

const EMPTY_WORD_SET = { word_set: [] };
const EMPTY_GENERATION = {
  pendingAction: null,
  pendingCount: null,
  pendingWordSet: null,
  progressStage: null,
  progressMessage: "",
  error: null,
  isGenerating: false,
  mode: null,
};

function applyKnownWordState(currentKeys, wordKey, shouldBeKnown) {
  if (shouldBeKnown) {
    return currentKeys.includes(wordKey)
      ? currentKeys
      : [...currentKeys, wordKey];
  }

  return currentKeys.filter((entry) => entry !== wordKey);
}

function cloneWordEntry(entry, index) {
  return {
    rk: Number(entry?.rk) || index + 1,
    dv: String(entry?.dv || ""),
    rm: String(entry?.rm || ""),
    en: String(entry?.en || ""),
  };
}

function toWordSet(entries = []) {
  return {
    word_set: Array.isArray(entries) ? entries.map(cloneWordEntry) : [],
  };
}

function normalizeWordSet(wordSet, fallbackEntries = []) {
  if (wordSet?.word_set && Array.isArray(wordSet.word_set)) {
    return toWordSet(wordSet.word_set);
  }

  return toWordSet(fallbackEntries);
}

function normalizeQuestions(level) {
  if (Array.isArray(level?.questions) && level.questions.length) {
    return level.questions.map((question) => ({
      ...question,
      options: Array.isArray(question.options) ? [...question.options] : [],
    }));
  }

  if (Array.isArray(level?.sentences)) {
    return level.sentences.map(buildQuestionOptions);
  }

  return [];
}

function normalizePreviousSentences(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.sentences)) {
    return value.sentences;
  }

  return null;
}

function normalizeLevel(level, fallbackWordSet = EMPTY_WORD_SET, options = {}) {
  if (!level) {
    return null;
  }

  const baseWordSet = normalizeWordSet(fallbackWordSet);
  const previousLevelSentences = normalizePreviousSentences(
    level.previousLevelSentences ?? options.previousLevelSentences,
  );

  return {
    ...level,
    sentences: Array.isArray(level.sentences) ? level.sentences : [],
    questions: normalizeQuestions(level),
    answers: Array.isArray(level.answers) ? [...level.answers] : [],
    isComplete: Boolean(level.isComplete),
    displayWordSet: normalizeWordSet(level.displayWordSet, baseWordSet.word_set),
    nextAction: level.nextAction ? { ...level.nextAction } : null,
    nextWordSet: level.nextWordSet
      ? normalizeWordSet(level.nextWordSet)
      : null,
    wordCount:
      typeof level.wordCount === "number"
        ? level.wordCount
        : baseWordSet.word_set.length,
    previousLevelSentences: previousLevelSentences
      ? { sentences: previousLevelSentences }
      : null,
  };
}

function buildPreviousLevelFromSentences(sentences, wordSet, wordCount) {
  const normalizedSentences = normalizePreviousSentences(sentences);

  if (!normalizedSentences?.length) {
    return null;
  }

  return {
    sentences: normalizedSentences,
    questions: normalizedSentences.map(buildQuestionOptions),
    answers: [],
    isComplete: true,
    displayWordSet: normalizeWordSet(wordSet),
    nextAction: null,
    nextWordSet: null,
    wordCount:
      typeof wordCount === "number"
        ? wordCount
        : normalizeWordSet(wordSet).word_set.length,
    previousLevelSentences: null,
  };
}

function sanitizePendingAction(action, count = null) {
  if (!action) {
    return null;
  }

  return count === null || count === undefined
    ? { action }
    : { action, count: Number(count) || 0 };
}

function sanitizeLevelForPersistence(level) {
  if (level === null) {
    return null;
  }

  if (!level) {
    return undefined;
  }

  return {
    sentences: Array.isArray(level.sentences) ? level.sentences : [],
    questions: Array.isArray(level.questions)
      ? level.questions.map((question) => ({
          ...question,
          options: Array.isArray(question.options) ? [...question.options] : [],
        }))
      : [],
    answers: Array.isArray(level.answers) ? [...level.answers] : [],
    isComplete: Boolean(level.isComplete),
    wordCount: Number(level.wordCount || 0),
    displayWordSet: level.displayWordSet
      ? normalizeWordSet(level.displayWordSet)
      : null,
    nextAction: level.nextAction ? { ...level.nextAction } : null,
    nextWordSet: level.nextWordSet ? normalizeWordSet(level.nextWordSet) : null,
  };
}

function getFeedLevels(previousLevel, currentLevel, levelNumber) {
  const levels = [];

  if (previousLevel?.questions?.length) {
    levels.push({
      key: `level-${levelNumber - 1}`,
      level: previousLevel,
      levelNumber: Math.max(levelNumber - 1, 1),
      isCurrent: false,
    });
  }

  if (currentLevel?.questions?.length) {
    levels.push({
      key: `level-${levelNumber}`,
      level: currentLevel,
      levelNumber: Math.max(levelNumber, 1),
      isCurrent: true,
    });
  }

  return levels;
}

function blurActiveElement() {
  if (typeof document === "undefined") {
    return;
  }

  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

function getHeaderWordCount(level, fallbackWordCount) {
  const nextAction = level?.nextAction;

  if (!nextAction) {
    return fallbackWordCount;
  }

  switch (nextAction.action) {
    case PENDING_ACTIONS.ADD:
      return fallbackWordCount + (nextAction.count || 0);
    case PENDING_ACTIONS.REMOVE:
      return Math.max(fallbackWordCount - (nextAction.count || 0), 0);
    default:
      return fallbackWordCount;
  }
}

function createStructuredClientError(payload, fallbackMessage) {
  const serialized = serializeError(
    payload instanceof Error ? payload : null,
    "generation",
  );

  const message =
    payload?.message || serialized.message || fallbackMessage || "Something went wrong.";
  const error = new Error(message);

  error.code = payload?.code || serialized.code;
  error.stage = payload?.stage || serialized.stage;
  error.details = payload?.details || serialized.details;
  error.source = payload?.source || serialized.source;

  return error;
}

export default function GameplayPage({ listId, listSlug }) {
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [listName, setListName] = useState("");
  const [currentWordSet, setCurrentWordSet] = useState(EMPTY_WORD_SET);
  const [knownWordKeys, setKnownWordKeys] = useState([]);
  const [showRomanization, setShowRomanization] = useState(true);
  const [levelNumber, setLevelNumber] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [previousLevel, setPreviousLevel] = useState(null);
  const [previousLevelSentences, setPreviousLevelSentences] = useState(null);
  const [generation, setGeneration] = useState(EMPTY_GENERATION);
  const [revealedQuestionKeys, setRevealedQuestionKeys] = useState({});
  const [isWordListOpen, setIsWordListOpen] = useState(false);
  const [sentenceWordsState, setSentenceWordsState] = useState(null);
  const [saveError, setSaveError] = useState("");
  const latestStateRef = useRef({
    currentWordSet: EMPTY_WORD_SET,
    knownWordKeys: [],
    showRomanization: true,
    levelNumber: 0,
    currentLevel: null,
    previousLevel: null,
    previousLevelSentences: null,
  });
  const generationRunIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const knownWordRequestVersionRef = useRef(new Map());
  const latestScrollYRef = useRef(0);
  const preserveOnNextRenderRef = useRef(false);
  const transitionBlockRefs = useRef(new Map());
  const anchorLevelNumberRef = useRef(null);
  const anchorViewportTopRef = useRef(null);
  const previousStatusRef = useRef(status);
  const headerFrameRef = useRef(null);
  const [headerOffset, setHeaderOffset] = useState(0);

  const wordCount = currentWordSet.word_set.length;
  const headerWordCount = getHeaderWordCount(currentLevel, wordCount);
  const displayWordSet =
    currentLevel?.displayWordSet || normalizeWordSet(currentWordSet);
  const levels = getFeedLevels(previousLevel, currentLevel, levelNumber);
  const dashboardHref = listSlug ? `/dashboard/${listSlug}` : "/dashboard";
  const gameplayHref = listSlug ? `/dashboard/${listSlug}/play` : "/dashboard";

  useEffect(() => {
    latestStateRef.current = {
      currentWordSet,
      knownWordKeys,
      showRomanization,
      levelNumber,
      currentLevel,
      previousLevel,
      previousLevelSentences,
    };
  }, [
    currentLevel,
    currentWordSet,
    knownWordKeys,
    levelNumber,
    previousLevel,
    previousLevelSentences,
    showRomanization,
  ]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      generationRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    latestScrollYRef.current = window.scrollY;

    function handleScroll() {
      latestScrollYRef.current = window.scrollY;

      if (anchorLevelNumberRef.current === null) {
        return;
      }

      const anchorNode = transitionBlockRefs.current.get(
        anchorLevelNumberRef.current,
      );

      if (anchorNode) {
        anchorViewportTopRef.current = anchorNode.getBoundingClientRect().top;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    const headerNode = headerFrameRef.current;

    if (!headerNode) {
      return undefined;
    }

    function syncHeaderOffset() {
      const nextOffset = Math.ceil(headerNode.getBoundingClientRect().height);
      setHeaderOffset((currentOffset) =>
        currentOffset === nextOffset ? currentOffset : nextOffset,
      );
    }

    syncHeaderOffset();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncHeaderOffset);
      return () => window.removeEventListener("resize", syncHeaderOffset);
    }

    const observer = new ResizeObserver(syncHeaderOffset);
    observer.observe(headerNode);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (preserveOnNextRenderRef.current) {
      window.scrollTo(0, latestScrollYRef.current);
      preserveOnNextRenderRef.current = false;
    }

    if (
      anchorLevelNumberRef.current !== null &&
      anchorViewportTopRef.current !== null
    ) {
      const anchorNode = transitionBlockRefs.current.get(
        anchorLevelNumberRef.current,
      );

      if (anchorNode) {
        const nextTop = anchorNode.getBoundingClientRect().top;
        const delta = nextTop - anchorViewportTopRef.current;

        if (delta) {
          window.scrollBy(0, delta);
        }

        anchorViewportTopRef.current = anchorNode.getBoundingClientRect().top;
      }
    }

    if (
      previousStatusRef.current === "generating" &&
      status === "playing"
    ) {
      anchorLevelNumberRef.current = null;
      anchorViewportTopRef.current = null;
    }

    previousStatusRef.current = status;
  }, [
    currentLevel?.isComplete,
    generation.pendingWordSet,
    levelNumber,
    status,
  ]);

  function setTransitionBlockRef(levelValue, node) {
    if (!node) {
      transitionBlockRefs.current.delete(levelValue);
      return;
    }

    transitionBlockRefs.current.set(levelValue, node);
  }

  function anchorTransitionBlock(levelValue) {
    const anchorNode = transitionBlockRefs.current.get(levelValue);

    anchorLevelNumberRef.current = levelValue;
    anchorViewportTopRef.current = anchorNode
      ? anchorNode.getBoundingClientRect().top
      : null;
  }

  function revealQuestion(questionKey) {
    setRevealedQuestionKeys((current) =>
      current[questionKey] ? current : { ...current, [questionKey]: true },
    );
  }

  async function persistSession(level, nextLevelNumber = latestStateRef.current.levelNumber) {
    setSaveError("");
    const nextPreviousLevelSentences =
      normalizePreviousSentences(level?.previousLevelSentences) ||
      latestStateRef.current.previousLevelSentences;

    try {
      const response = await fetch(`/api/lists/${listId}/session`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelNumber: nextLevelNumber,
          currentLevel: sanitizeLevelForPersistence(level),
          previousLevel: sanitizeLevelForPersistence(
            latestStateRef.current.previousLevel,
          ),
          previousLevelSentences: nextPreviousLevelSentences,
        }),
      });

      if (!response.ok) {
        throw createStructuredClientError(
          await response.json().catch(() => null),
          "Could not save your latest progress.",
        );
      }
    } catch (error) {
      setSaveError(error.message || "Could not save your latest progress.");
    }
  }

  const startGeneration = useCallback(async (action, count = null, options = {}) => {
    const runId = generationRunIdRef.current + 1;
    generationRunIdRef.current = runId;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pendingAction = sanitizePendingAction(action, count);
    const startingFresh = options.isInitial || !latestStateRef.current.currentLevel;
    let streamedWordSet = null;

    setSaveError("");
    setIsWordListOpen(false);
    setSentenceWordsState(null);
    setGeneration({
      pendingAction: action,
      pendingCount: count,
      pendingWordSet: null,
      progressStage: "words",
      progressMessage: "Preparing word set...",
      error: null,
      isGenerating: true,
      mode: startingFresh ? "initial" : "next-level",
    });
    setStatus(startingFresh ? "starting" : "generating");

    if (!startingFresh) {
      setCurrentLevel((level) =>
        level
          ? {
              ...level,
              nextAction: pendingAction,
              nextWordSet: null,
            }
          : level,
      );
    }

    try {
      const response = await fetch(`/api/lists/${listId}/generate`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, count }),
      });

      if (runId !== generationRunIdRef.current) {
        return;
      }

      if (!response.ok || !response.body) {
        throw createStructuredClientError(
          await response.json().catch(() => null),
          "Failed to start generation.",
        );
      }

      await consumeSseStream(response.body, async ({ event, data }) => {
        if (runId !== generationRunIdRef.current) {
          return;
        }

        if (event === "progress") {
          setGeneration((current) => ({
            ...current,
            progressStage: data?.stage || current.progressStage,
            progressMessage: data?.message || current.progressMessage,
          }));
          return;
        }

        if (event === "word-set") {
          streamedWordSet = normalizeWordSet({
            word_set: data?.currentWordSet,
          });

          setGeneration((current) => ({
            ...current,
            pendingWordSet: streamedWordSet,
          }));

          if (!startingFresh) {
            setCurrentLevel((level) =>
              level
                ? {
                    ...level,
                    nextAction: pendingAction,
                    nextWordSet: streamedWordSet,
                  }
                : level,
            );
          }

          return;
        }

        if (event === "error") {
          throw createStructuredClientError(
            data,
            "Generation failed before the next level could be prepared.",
          );
        }

        if (event !== "complete") {
          return;
        }

        const nextWordSet = normalizeWordSet({
          word_set: data?.currentWordSet,
        });
        const previousState = latestStateRef.current;
        const priorCurrentLevel = previousState.currentLevel
          ? {
              ...previousState.currentLevel,
              nextAction: pendingAction,
              nextWordSet:
                streamedWordSet || previousState.currentLevel.nextWordSet || null,
            }
          : null;
        const nextLevelNumber = Number(data?.levelNumber || 0);
        const normalizedNextLevel = normalizeLevel(
          data?.currentLevel,
          nextWordSet,
          {
            previousLevelSentences: data?.previousLevelSentences,
          },
        );
        const normalizedPreviousLevel = normalizeLevel(
          data?.previousLevel,
          previousState.currentWordSet,
          {
            previousLevelSentences: data?.previousLevelSentences,
          },
        );

        setCurrentWordSet(nextWordSet);
        setLevelNumber(nextLevelNumber);
        setCurrentLevel(normalizedNextLevel);
        setPreviousLevel(
          normalizedPreviousLevel ||
            priorCurrentLevel ||
            buildPreviousLevelFromSentences(
              data?.previousLevelSentences,
              previousState.currentWordSet,
              previousState.currentLevel?.wordCount,
            ),
        );
        setPreviousLevelSentences(
          normalizePreviousSentences(data?.previousLevelSentences),
        );
        setGeneration(EMPTY_GENERATION);
        setStatus("playing");
        setRevealedQuestionKeys({});
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      if (runId !== generationRunIdRef.current) {
        return;
      }

      setGeneration((current) => ({
        ...current,
        isGenerating: false,
        error: serializeError(error, "generation"),
      }));
      setStatus(startingFresh ? "error" : "playing");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [listId]);

  useEffect(() => {
    let isCancelled = false;

    async function loadListState() {
      setStatus("loading");
      setGeneration(EMPTY_GENERATION);
      setSaveError("");

      try {
        const response = await fetch(`/api/lists/${listId}`, {
          cache: "no-store",
        });

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            router.replace(`/login?callbackUrl=${gameplayHref}`);
            return;
          }

          throw createStructuredClientError(
            await response.json().catch(() => null),
            "Failed to load this word list.",
          );
        }

        const payload = await response.json();

        if (isCancelled) {
          return;
        }

        const normalizedWordSet = normalizeWordSet({
          word_set: payload.currentWordSet,
        });
        const normalizedCurrentLevel = normalizeLevel(
          payload.session?.currentLevel,
          normalizedWordSet,
          {
            previousLevelSentences: payload.session?.previousLevelSentences,
          },
        );
        const normalizedPreviousLevel = normalizeLevel(
          payload.session?.previousLevel,
          normalizedWordSet,
          {
            previousLevelSentences: payload.session?.previousLevelSentences,
          },
        );
        const restoredPreviousLevel =
          normalizedPreviousLevel ||
          (payload.session?.levelNumber > 1
            ? buildPreviousLevelFromSentences(
                payload.session?.previousLevelSentences,
                normalizedWordSet,
                normalizedCurrentLevel?.wordCount,
              )
            : null);

        setListName(payload.name || "");
        setCurrentWordSet(normalizedWordSet);
        setKnownWordKeys(
          Array.isArray(payload.knownWordKeys) ? payload.knownWordKeys : [],
        );
        setShowRomanization(payload.showRomanization ?? true);
        setLevelNumber(Number(payload.session?.levelNumber || 0));
        setCurrentLevel(normalizedCurrentLevel);
        setPreviousLevel(restoredPreviousLevel);
        setPreviousLevelSentences(
          normalizePreviousSentences(payload.session?.previousLevelSentences),
        );
        setRevealedQuestionKeys({});

        if (payload.session?.levelNumber > 0 && normalizedCurrentLevel?.questions?.length) {
          setStatus("playing");
          return;
        }

        setStatus("starting");
        void startGeneration(PENDING_ACTIONS.SAME, null, { isInitial: true });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setStatus("error");
        setGeneration({
          ...EMPTY_GENERATION,
          error: serializeError(error, "loading"),
        });
      }
    }

    void loadListState();

    return () => {
      isCancelled = true;
      abortControllerRef.current?.abort();
      generationRunIdRef.current += 1;
    };
  }, [gameplayHref, listId, router, startGeneration]);

  function handleSubmitAnswer(questionNumber, selectedOption, levelScope = "current") {
    if (levelScope === "previous") {
      setPreviousLevel((level) => {
        if (!level) {
          return level;
        }

        const outcome = submitAnswer(level, questionNumber, selectedOption);
        return outcome.didUpdate ? outcome.level : level;
      });
      return;
    }

    let nextLevel = null;

    setCurrentLevel((level) => {
      if (!level) {
        return level;
      }

      const outcome = submitAnswer(level, questionNumber, selectedOption);

      if (!outcome.didUpdate) {
        return level;
      }

      nextLevel = outcome.level;
      return outcome.level;
    });

    if (nextLevel) {
      const nextPreviousLevelSentences = normalizePreviousSentences(
        nextLevel.previousLevelSentences,
      );

      if (nextPreviousLevelSentences) {
        setPreviousLevelSentences(nextPreviousLevelSentences);
      }

      void persistSession(nextLevel);
    }
  }

  function handleCompleteLevel() {
    let nextLevel = null;

    setCurrentLevel((level) => {
      if (!level) {
        return level;
      }

      const outcome = completeLevel(level);

      if (!outcome.didUpdate) {
        return level;
      }

      nextLevel = outcome.level;
      return outcome.level;
    });

    if (nextLevel) {
      const nextPreviousLevelSentences = normalizePreviousSentences(
        nextLevel.previousLevelSentences,
      );

      if (nextPreviousLevelSentences) {
        setPreviousLevelSentences(nextPreviousLevelSentences);
      }

      void persistSession(nextLevel);
    }
  }

  function handleToggleRomanization() {
    const previousValue = latestStateRef.current.showRomanization;
    const nextValue = !previousValue;

    setShowRomanization(nextValue);
    setSaveError("");

    void (async () => {
      try {
        const response = await fetch(`/api/lists/${listId}/preferences`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            showRomanization: nextValue,
          }),
        });

        if (!response.ok) {
          throw createStructuredClientError(
            await response.json().catch(() => null),
            "Could not save the romanization preference.",
          );
        }
      } catch (error) {
        setShowRomanization(previousValue);
        setSaveError(
          error.message || "Could not save the romanization preference.",
        );
      }
    })();
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
    setSaveError("");

    void (async () => {
      try {
        const response = await fetch(`/api/lists/${listId}/known-words`, {
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

        if (!response.ok) {
          throw createStructuredClientError(
            await response.json().catch(() => null),
            "Could not save the known-word update.",
          );
        }
      } catch (error) {
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
        setSaveError(error.message || "Could not save the known-word update.");
      }
    })();
  }

  function handleToggleKnownWord(word) {
    const wordKey = getKnownWordKey(word);

    if (!wordKey) {
      return;
    }

    updateKnownWord(word, !latestStateRef.current.knownWordKeys.includes(wordKey));
  }

  function handleAddKnownWord(word) {
    const wordKey = getKnownWordKey(word);

    if (!wordKey || latestStateRef.current.knownWordKeys.includes(wordKey)) {
      return;
    }

    updateKnownWord(word, true);
  }

  function renderInlineErrorCard() {
    if (!generation.error) {
      return null;
    }

    return (
      <section className="glass-panel rounded-[2rem] border border-coral/18 bg-coral/6 p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-coral/70">
              Generation error
            </p>
            <h3 className="mt-2 text-2xl text-ink sm:text-3xl">
              The next level could not be prepared.
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              {generation.error.message}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SecondaryButton
              onClick={() =>
                startGeneration(
                  generation.pendingAction || PENDING_ACTIONS.SAME,
                  generation.pendingCount,
                  {
                    isInitial: generation.mode === "initial",
                  },
                )
              }
            >
              Retry generation
            </SecondaryButton>
            <SecondaryButton onClick={() => router.push(dashboardHref)}>
              Back to list
            </SecondaryButton>
          </div>
        </div>
      </section>
    );
  }

  function renderLoadingState() {
    const previewWordSet = generation.pendingWordSet || currentWordSet;
    const previewWordCount = previewWordSet.word_set.length;
    const isInitialLoad =
      generation.mode === "initial" || (!currentLevel && status !== "loading");

    return (
      <div className="page-enter mx-auto grid w-full max-w-6xl gap-4 px-6 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <section className="glass-panel rounded-[2.2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <LoadingSpinner />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink/45">
                {status === "loading" ? "Loading word list" : "Loading next level"}
              </p>
              <h1 className="mt-3 text-4xl leading-tight text-ink sm:text-5xl">
                {status === "loading"
                  ? "Preparing your workspace"
                  : isInitialLoad
                    ? "Preparing your first level"
                    : titleizePendingAction(
                        generation.pendingAction || PENDING_ACTIONS.SAME,
                      )}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-ink/65">
                {generation.progressMessage ||
                  "We're loading your saved state and preparing the next validated sentence batch."}
              </p>
            </div>

            <div className="soft-pill rounded-[1.7rem] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                Upcoming deck
              </p>
              <p className="mt-2 text-sm text-ink/70">
                {previewWordCount
                  ? `${previewWordCount} ${pluralize(previewWordCount, "word")} queued for the next round.`
                  : "Waiting for the first validated word set from the generator."}
              </p>
            </div>

            {generation.error ? (
              <div className="rounded-[1.6rem] border border-coral/18 bg-coral/8 px-4 py-4 text-sm text-coral">
                <p className="font-semibold uppercase tracking-[0.18em]">
                  Could not prepare the level
                </p>
                <p className="mt-2">{generation.error.message}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SecondaryButton
                    onClick={() =>
                      startGeneration(PENDING_ACTIONS.SAME, null, {
                        isInitial: true,
                      })
                    }
                  >
                    Retry
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => router.push(dashboardHref)}
                  >
                    Back to list
                  </SecondaryButton>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="glass-panel rounded-[2.2rem] p-6 sm:p-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
              Preview
            </p>
            <h2 className="mt-2 text-3xl text-ink">
              {listName ? `${listName} words in play` : "Words in play next"}
            </h2>
          </div>
          <WordListPreview
            wordSet={previewWordSet}
            knownWordKeys={knownWordKeys}
            onToggleKnownWord={handleToggleKnownWord}
          />
        </section>
      </div>
    );
  }

  if (status !== "playing" && !currentLevel) {
    return renderLoadingState();
  }

  if (!currentLevel?.questions?.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="fixed inset-x-0 top-0 z-40">
        <div
          className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div ref={headerFrameRef} className="pb-1">
            <HeaderBar
              wordCount={headerWordCount}
              onBackToList={() => router.push(dashboardHref)}
              onOpenWordList={() => setIsWordListOpen(true)}
              romanizationEnabled={showRomanization}
              onToggleRomanization={handleToggleRomanization}
            />
          </div>
        </div>
      </div>
      <div aria-hidden="true" style={{ height: headerOffset }} />

      <div className="page-enter px-4 pb-8 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-[42rem] space-y-4">
          {saveError ? (
            <p className="rounded-2xl border border-coral/18 bg-coral/10 px-4 py-3 text-sm text-coral">
              {saveError}
            </p>
          ) : null}

          <div className="space-y-10" style={{ overflowAnchor: "none" }}>
            {levels.map(({ key, level, levelNumber: levelValue, isCurrent }) => (
              <div
                key={key}
                className="space-y-4"
                style={{ overflowAnchor: "none" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                      {isCurrent ? "Current level" : "Previous level"}
                    </p>
                    <h2 className="mt-1 text-2xl text-ink sm:text-3xl">
                      Level {levelValue}
                    </h2>
                  </div>
                  <span className="soft-pill rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink/55">
                    {level.wordCount} active words
                  </span>
                </div>

                {level.questions.map((question) => {
                  const questionKey = `${levelValue}-${question.questionNumber}`;
                  const answerRecord =
                    level.answers.find(
                      (item) => item.questionNumber === question.questionNumber,
                    ) || null;

                  return (
                    <article
                      key={questionKey}
                      className="space-y-4 animate-float-up"
                    >
                      <SentenceCard
                        question={question}
                        showRomanization={showRomanization}
                        answerRecord={answerRecord}
                        headerControls={
                          <button
                            type="button"
                            className="soft-pill rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/65 transition hover:bg-white"
                            onClick={() =>
                              setSentenceWordsState({
                                sentence:
                                  level.sentences.find(
                                    (item) => item.nm === question.questionNumber,
                                  ) || null,
                                wordSet: level.displayWordSet || currentWordSet,
                                baseWordCount: level.wordCount || 0,
                              })
                            }
                          >
                            Words
                          </button>
                        }
                      >
                        <AnswerOptionsList
                          question={question}
                          answerRecord={answerRecord}
                          interactionDisabled={isCurrent ? level.isComplete : false}
                          isRevealed={
                            Boolean(answerRecord) ||
                            Boolean(revealedQuestionKeys[questionKey])
                          }
                          onReveal={() => revealQuestion(questionKey)}
                          onSelect={(selectedOption) => {
                            if (isCurrent && level.isComplete) {
                              return;
                            }

                            blurActiveElement();
                            latestScrollYRef.current = window.scrollY;
                            preserveOnNextRenderRef.current = true;
                            handleSubmitAnswer(
                              question.questionNumber,
                              selectedOption,
                              isCurrent ? "current" : "previous",
                            );
                          }}
                        />
                      </SentenceCard>
                    </article>
                  );
                })}

                {isCurrent && !level.isComplete ? (
                  <div className="flex justify-center pt-2">
                    <SecondaryButton
                      className="w-full sm:w-auto"
                      onClick={() => {
                        blurActiveElement();
                        latestScrollYRef.current = window.scrollY;
                        preserveOnNextRenderRef.current = true;
                        handleCompleteLevel();
                      }}
                    >
                      Skip to next level
                    </SecondaryButton>
                  </div>
                ) : null}

                {level.isComplete && (isCurrent || level.nextAction) ? (
                  <div
                    ref={(node) => setTransitionBlockRef(levelValue, node)}
                    className="space-y-4"
                    style={{ overflowAnchor: "none" }}
                  >
                    <LevelTransitionCard
                      levelNumber={levelValue}
                      wordCount={level.wordCount}
                      transition={level.nextAction}
                      onSameWords={() => {
                        blurActiveElement();
                        anchorTransitionBlock(levelValue);
                        void startGeneration(PENDING_ACTIONS.SAME);
                      }}
                      onResampleWords={() => {
                        blurActiveElement();
                        anchorTransitionBlock(levelValue);
                        void startGeneration(PENDING_ACTIONS.RESAMPLE);
                      }}
                      onAddWords={(count) => {
                        blurActiveElement();
                        anchorTransitionBlock(levelValue);
                        void startGeneration(PENDING_ACTIONS.ADD, count);
                      }}
                      onRemoveWords={(count) => {
                        blurActiveElement();
                        anchorTransitionBlock(levelValue);
                        void startGeneration(PENDING_ACTIONS.REMOVE, count);
                      }}
                    />

                    {level.nextAction ? (
                      <NextLevelLoadingCard
                        pendingAction={level.nextAction.action}
                        pendingWordSet={
                          (isCurrent && generation.pendingWordSet) ||
                          level.nextWordSet
                        }
                        isLoading={isCurrent && generation.isGenerating}
                        showRomanization={showRomanization}
                      />
                    ) : null}

                    {isCurrent && generation.error ? renderInlineErrorCard() : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <WordListModal
        isOpen={isWordListOpen}
        wordSet={displayWordSet}
        baseWordCount={wordCount}
        knownWordKeys={knownWordKeys}
        onToggleKnownWord={handleToggleKnownWord}
        onAddToKnown={handleAddKnownWord}
        showRomanization={showRomanization}
        isOwner
        onClose={() => setIsWordListOpen(false)}
      />
      <SentenceWordsModal
        isOpen={Boolean(sentenceWordsState)}
        sentence={sentenceWordsState?.sentence || null}
        wordSet={sentenceWordsState?.wordSet || null}
        baseWordCount={sentenceWordsState?.baseWordCount || 0}
        onClose={() => setSentenceWordsState(null)}
      />
    </div>
  );
}
