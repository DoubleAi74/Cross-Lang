import corpus from "@/lib/corpus/hindi-corpus.json";
import { AppError } from "@/lib/errors";
import {
  deriveControlledHindiTokens,
  normalizeHindiText,
} from "@/lib/hindi/tokens";
import { transliterateHindiToken } from "@/lib/hindi/transliteration";

const CORPUS = corpus.word_set;
const B = 5;
const ALPHA = 1.5;
const CORPUS_SIZE = CORPUS.length;

const CORPUS_RANK_BY_WORD = new Map();
const CANONICAL_ENTRY_BY_WORD = new Map();
const CANONICAL_ENTRY_BY_DERIVED_TOKEN = new Map();

function deriveDisplayLookupTokens(entry) {
  const derived = new Set(deriveControlledHindiTokens(entry));

  [...derived].forEach((token) => {
    if (!token.endsWith("ो")) {
      return;
    }

    ["गा", "गी", "गे"].forEach((suffix) => {
      derived.add(`${token}${suffix}`);
    });
  });

  return derived;
}

CORPUS.forEach((entry) => {
  const normalized = normalizeHindiText(entry.dv);

  if (!normalized || CORPUS_RANK_BY_WORD.has(normalized)) {
    return;
  }

  CORPUS_RANK_BY_WORD.set(normalized, entry.rk);
  CANONICAL_ENTRY_BY_WORD.set(normalized, entry);

  deriveDisplayLookupTokens(entry).forEach((token) => {
    const normalizedToken = normalizeHindiText(token);

    if (
      !normalizedToken ||
      CANONICAL_ENTRY_BY_DERIVED_TOKEN.has(normalizedToken)
    ) {
      return;
    }

    CANONICAL_ENTRY_BY_DERIVED_TOKEN.set(normalizedToken, entry);
  });
});

function validatePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(`${label} must be a positive integer.`, {
      code: "invalid_sampler_count",
      stage: "generation",
      details: { [label]: value },
      source: "sampler",
    });
  }
}

function validateGenerateWordCount(wordCount) {
  validatePositiveInteger(wordCount, "wordCount");

  if (wordCount > CORPUS_SIZE) {
    throw new AppError(`wordCount must be between 1 and ${CORPUS_SIZE}.`, {
      code: "invalid_word_count",
      stage: "generation",
      details: { wordCount, maxWordCount: CORPUS_SIZE },
      source: "sampler",
    });
  }
}

function getCorpusRank(entry) {
  const normalized = normalizeHindiText(entry?.dv);
  const rank = CORPUS_RANK_BY_WORD.get(normalized);

  if (!rank) {
    throw new AppError("Encountered a word that does not exist in the master corpus.", {
      code: "unknown_corpus_word",
      stage: "generation",
      details: entry,
      source: "sampler",
    });
  }

  return rank;
}

function cloneWordEntry(entry, rk) {
  return {
    rk,
    dv: entry.dv,
    rm: entry.rm,
    en: entry.en,
  };
}

function renumberWordSet(entries) {
  return {
    word_set: entries.map((entry, index) => cloneWordEntry(entry, index + 1)),
  };
}

function sortByCorpusRank(entries) {
  return [...entries].sort((left, right) => getCorpusRank(left) - getCorpusRank(right));
}

export function lookupCorpusTokenDetails(token) {
  const normalized = normalizeHindiText(token);

  if (!normalized) {
    return null;
  }

  const exactEntry = CANONICAL_ENTRY_BY_WORD.get(normalized);

  if (exactEntry) {
    return {
      dv: exactEntry.dv,
      rm: exactEntry.rm,
      en: exactEntry.en,
    };
  }

  const derivedFromEntry = CANONICAL_ENTRY_BY_DERIVED_TOKEN.get(normalized);

  if (!derivedFromEntry) {
    return null;
  }

  return {
    dv: normalized,
    rm: transliterateHindiToken(normalized),
    en: derivedFromEntry.en,
  };
}

function sampleFromPool(pool, count) {
  const entries = [...pool];
  const weights = entries.map((entry) => Math.pow(entry.rk + B, -ALPHA));
  const selected = [];

  for (let step = 0; step < count && entries.length; step += 1) {
    let totalWeight = 0;

    for (let index = 0; index < weights.length; index += 1) {
      totalWeight += weights[index];
    }

    const target = Math.random() * totalWeight;
    let cumulative = 0;

    for (let index = 0; index < weights.length; index += 1) {
      cumulative += weights[index];

      if (cumulative >= target) {
        const normalized = normalizeHindiText(entries[index].dv);
        const selectedEntry = CANONICAL_ENTRY_BY_WORD.get(normalized) || entries[index];

        selected.push(selectedEntry);

        for (let removeIndex = entries.length - 1; removeIndex >= 0; removeIndex -= 1) {
          if (normalizeHindiText(entries[removeIndex].dv) === normalized) {
            entries.splice(removeIndex, 1);
            weights.splice(removeIndex, 1);
          }
        }

        break;
      }
    }
  }

  return selected;
}

export async function generateWordList(wordCount) {
  validateGenerateWordCount(wordCount);
  const selectedEntries = sampleFromPool(CORPUS, wordCount);

  if (selectedEntries.length < wordCount) {
    throw new AppError(
      `Word generation produced ${selectedEntries.length} unique words, need ${wordCount}.`,
      {
        code: "insufficient_word_count",
        stage: "generation",
        details: {
          requestedWordCount: wordCount,
          uniqueWordCount: selectedEntries.length,
        },
        source: "sampler",
      },
    );
  }

  return renumberWordSet(selectedEntries.sort((left, right) => left.rk - right.rk));
}

export async function addWordsToList(wordSet, count, theme = "") {
  void theme;
  validatePositiveInteger(count, "count");

  const existingWords = wordSet?.word_set || [];
  const existingTokens = new Set(
    existingWords.map((entry) => normalizeHindiText(entry.dv)).filter(Boolean),
  );
  const pool = CORPUS.filter(
    (entry) => !existingTokens.has(normalizeHindiText(entry.dv)),
  );

  if (!pool.length) {
    throw new AppError("No additional words are available to add.", {
      code: "no_words_available",
      stage: "generation",
      details: {
        requestedNewWordCount: count,
        currentWordCount: existingWords.length,
      },
      source: "sampler",
    });
  }

  const additions = sampleFromPool(pool, count);
  return renumberWordSet(sortByCorpusRank([...existingWords, ...additions]));
}

export async function removeWordsFromList(wordSet, count, theme = "") {
  void theme;
  validatePositiveInteger(count, "count");

  const existingWords = wordSet?.word_set || [];

  if (count >= existingWords.length) {
    throw new AppError("Cannot remove all words from the list.", {
      code: "invalid_remove_count",
      stage: "generation",
      details: {
        requestedRemoveCount: count,
        currentWordCount: existingWords.length,
      },
      source: "sampler",
    });
  }

  const remainingWords = sortByCorpusRank(existingWords).slice(
    0,
    existingWords.length - count,
  );

  return renumberWordSet(remainingWords);
}
