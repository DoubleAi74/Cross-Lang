import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  addWordsToList,
  generateWordList,
  lookupCorpusTokenDetails,
  removeWordsFromList,
} from "@/lib/corpus/sampler";
import {
  DEFAULT_ADJUSTMENT_COUNT,
  LEVEL_SIZE,
  MAX_GENERATION_ATTEMPTS,
  MAX_WORD_COUNT,
  MIN_WORD_SET_SIZE,
  OPENAI_MODEL,
  PENDING_ACTIONS,
} from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { buildQuestionOptions } from "@/lib/game";
import {
  buildAllowedHindiTokenSet,
  buildSentenceLengthGuidance,
  extractHindiTokens,
  normalizeHindiToken,
} from "@/lib/hindi/tokens";
import {
  transliterateHindi,
  transliterateHindiToken,
} from "@/lib/hindi/transliteration";
import { clamp, coerceInteger, stringifyDetails } from "@/lib/utils";
import {
  buildDisplayTokenGlossPrompt,
  buildSentenceListPrompt,
} from "@/lib/generation/prompts";
import {
  llmDisplayTokenGlossSetSchema,
  llmSentenceSetSchema,
  validateSentenceSet,
} from "@/lib/generation/validation";

let client = null;

const EXTRA_SENTENCE_BUFFER = 5;
const MIN_INITIAL_SENTENCE_CANDIDATE_COUNT = 30;
const MIN_VALID_SENTENCES_BEFORE_TOP_UP = 5;
const DEFAULT_RETRY_ON_LOW_VALID_COUNT = true;
const MAX_SENTENCE_TOP_UP_ATTEMPTS = 1;
const DISPLAY_WORD_FALLBACK_PREFIX = "seen in:";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AppError("Missing OPENAI_API_KEY. Add it to your local server environment.", {
      code: "missing_api_key",
      stage: "configuration",
      source: "openai",
    });
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

function formatSchemaName(stage) {
  return String(stage || "generation")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
}

async function retryWithValidation(
  asyncFn,
  validateFn,
  maxAttempts = MAX_GENERATION_ATTEMPTS,
  options = {},
) {
  const { stage = null } = options;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await asyncFn(attempt, lastError);
      return validateFn(result, attempt);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new AppError("Generation failed after exhausting retries.", {
    code: "generation_retry_exhausted",
    stage,
  });
}

async function requestModelJson({
  buildPrompt,
  schema,
  validate,
  stage,
}) {
  return retryWithValidation(
    async (attempt, lastError) => {
      const openai = getOpenAIClient();
      const prompt = buildPrompt(attempt, lastError);
      const response = await openai.responses.parse({
        model: OPENAI_MODEL,
        input: prompt,
        text: {
          format: zodTextFormat(schema, formatSchemaName(stage)),
          verbosity: "medium",
        },
      });

      if (!response.output_parsed) {
        throw new AppError("The model response did not include parsed structured output.", {
          code: "missing_parsed_output",
          stage,
          source: "openai",
        });
      }

      return response.output_parsed;
    },
    validate,
    MAX_GENERATION_ATTEMPTS,
    { stage },
  );
}

function cloneWordEntries(entries = []) {
  return entries.map((entry, index) => ({
    rk: Number(entry?.rk) || index + 1,
    dv: entry.dv,
    rm: entry.rm,
    en: entry.en,
  }));
}

function cloneLevelSnapshot(level) {
  if (!level) {
    return null;
  }

  const plainLevel =
    typeof level.toObject === "function" ? level.toObject() : level;

  return {
    sentences: Array.isArray(plainLevel.sentences) ? [...plainLevel.sentences] : [],
    questions: Array.isArray(plainLevel.questions)
      ? plainLevel.questions.map((question) => ({
          ...question,
          options: Array.isArray(question.options) ? [...question.options] : [],
        }))
      : [],
    answers: Array.isArray(plainLevel.answers) ? [...plainLevel.answers] : [],
    isComplete: Boolean(plainLevel.isComplete),
    wordCount: Number(plainLevel.wordCount || 0),
    displayWordSet: plainLevel.displayWordSet
      ? toWordSet(plainLevel.displayWordSet.word_set || plainLevel.displayWordSet)
      : null,
    nextAction: plainLevel.nextAction ? { ...plainLevel.nextAction } : null,
    nextWordSet: plainLevel.nextWordSet
      ? toWordSet(plainLevel.nextWordSet.word_set || plainLevel.nextWordSet)
      : null,
  };
}

function toWordSet(entries = []) {
  return {
    word_set: cloneWordEntries(entries),
  };
}

function formatInvalidSentenceSummary(invalidSentences, maxItems = 5) {
  if (!invalidSentences.length) {
    return "none";
  }

  return invalidSentences
    .slice(0, maxItems)
    .map(({ index, sentence, extraTokens }) => {
      return `#${index + 1} "${truncateText(sentence?.dv || "", 60)}" -> forbidden tokens: ${extraTokens.join(", ")}`;
    })
    .join("\n");
}

function normalizeSentenceFingerprint(value) {
  return String(value || "")
    .replace(/[।.,!?;:"'`()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifySentences(sentences, allowedTokenSet, previousSentences = null) {
  const valid = [];
  const invalid = [];
  const previousSentenceFingerprints = new Set(
    normalizePreviousSentenceList(previousSentences)
      .map((item) => normalizeSentenceFingerprint(item?.dv))
      .filter(Boolean),
  );
  const seenSentenceFingerprints = new Set();

  sentences.forEach((sentence, index) => {
    const sentenceFingerprint = normalizeSentenceFingerprint(sentence?.dv);
    const extraTokens = [
      ...new Set(
        extractHindiTokens(sentence.dv)
          .map((token) => normalizeHindiToken(token))
          .filter((token) => token && !allowedTokenSet.has(token)),
      ),
    ];

    if (
      sentenceFingerprint &&
      (previousSentenceFingerprints.has(sentenceFingerprint) ||
        seenSentenceFingerprints.has(sentenceFingerprint))
    ) {
      return;
    }

    if (extraTokens.length) {
      invalid.push({ sentence, extraTokens, index });
      return;
    }

    if (sentenceFingerprint) {
      seenSentenceFingerprints.add(sentenceFingerprint);
    }

    valid.push(sentence);
  });

  return { valid, invalid };
}

function enrichSentenceSet(rawSentenceSet) {
  return {
    sentences: rawSentenceSet.sentences.map((item, index) => ({
      ...item,
      nm: index + 1,
      rm: transliterateHindi(item.dv),
    })),
  };
}

function renumberSentenceSet(sentences) {
  return enrichSentenceSet({ sentences });
}

function truncateText(value, maxLength = 44) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getInitialSentenceCandidateCount(sentenceCount) {
  return Math.max(
    sentenceCount + EXTRA_SENTENCE_BUFFER,
    MIN_INITIAL_SENTENCE_CANDIDATE_COUNT,
  );
}

function shouldRetrySentenceTopUp(
  validCount,
  sentenceCount,
  retryOnLowValidCount = true,
) {
  return (
    retryOnLowValidCount &&
    validCount < sentenceCount &&
    validCount < MIN_VALID_SENTENCES_BEFORE_TOP_UP
  );
}

function normalizePreviousSentenceList(previousSentences) {
  if (Array.isArray(previousSentences)) {
    return previousSentences;
  }

  if (Array.isArray(previousSentences?.sentences)) {
    return previousSentences.sentences;
  }

  return [];
}

export function buildAntiRepeatBlock(previousSentences) {
  const previousHindiSentences = normalizePreviousSentenceList(previousSentences)
    .map((item) => String(item?.dv || "").trim())
    .filter(Boolean);

  if (!previousHindiSentences.length) {
    return "";
  }

  return `Anti-repeat:
- Do not reuse any Hindi "dv" sentence from the previous sentence list
- Avoid trivial near-duplicates that differ only by punctuation or tiny wording changes
- Make the new Hindi target sentences feel recognizably new

Previous Hindi sentences:
${JSON.stringify(previousHindiSentences, null, 2)}`;
}

function buildSentenceGenerationPrompt({
  wordSet,
  sentenceCount,
  previousSentences = null,
  strictCompliance = false,
}) {
  const allowedTokenSet = [...buildAllowedHindiTokenSet(wordSet)].sort();
  const strictBlock = strictCompliance
    ? `Additional priority:
- Double-check every Hindi token against the allowed Hindi token set before returning
- If you are unsure whether a token is allowed, do not use it
- Prefer a simpler sentence over using even one forbidden token`
    : "";

  return buildSentenceListPrompt({
    allowedHindiTokenSet: JSON.stringify(allowedTokenSet, null, 2),
    antiRepeatBlock: buildAntiRepeatBlock(previousSentences),
    sentenceCount,
    sentenceLengthGuidance: buildSentenceLengthGuidance(wordSet.word_set.length),
    strictBlock,
  });
}

function buildRetryPrompt(basePrompt, attempt, lastError) {
  if (attempt === 1 || !lastError) {
    return basePrompt;
  }

  const details = stringifyDetails(lastError.details || lastError.message || lastError);

  return `${basePrompt}

Previous attempt failed validation. Fix these issues exactly:
${details}

Return only the corrected final JSON object.`;
}

async function requestSentenceCandidates({
  wordSet,
  sentenceCount,
  previousSentences = null,
  stage,
  strictCompliance = false,
  allowPartial = false,
}) {
  const basePrompt = buildSentenceGenerationPrompt({
    wordSet,
    sentenceCount,
    previousSentences,
    strictCompliance,
  });

  return requestModelJson({
    buildPrompt: (attempt, lastError) =>
      buildRetryPrompt(basePrompt, attempt, lastError),
    schema: llmSentenceSetSchema,
    stage,
    validate: (value) =>
      validateSentenceSet(value, sentenceCount, { allowPartial }),
  });
}

function pickFallbackInvalidSentences(invalidSentences, count) {
  return [...invalidSentences]
    .sort((left, right) => {
      if (left.extraTokens.length !== right.extraTokens.length) {
        return left.extraTokens.length - right.extraTokens.length;
      }

      return left.index - right.index;
    })
    .slice(0, count);
}

function buildDisplayWordSet(wordSet, invalidSentences, allowedTokenSet) {
  const seenTokens = new Set(
    wordSet.word_set.map((word) => normalizeHindiToken(word.dv)).filter(Boolean),
  );
  const extraWords = [];

  invalidSentences.forEach(({ sentence, extraTokens }) => {
    extraTokens.forEach((token) => {
      const normalizedToken = normalizeHindiToken(token);

      if (
        !normalizedToken ||
        seenTokens.has(normalizedToken) ||
        allowedTokenSet.has(normalizedToken)
      ) {
        return;
      }

      seenTokens.add(normalizedToken);
      const corpusTokenDetails = lookupCorpusTokenDetails(normalizedToken);

      extraWords.push({
        rk: wordSet.word_set.length + extraWords.length + 1,
        dv: normalizedToken,
        rm: corpusTokenDetails?.rm || transliterateHindiToken(normalizedToken),
        en: corpusTokenDetails?.en || `seen in: ${truncateText(sentence.en)}`,
      });
    });
  });

  if (!extraWords.length) {
    return null;
  }

  return {
    word_set: [...wordSet.word_set, ...extraWords],
  };
}

function isUnresolvedDisplayOnlyWord(word, baseWordCount = 0) {
  return (
    Number(word?.rk) > baseWordCount &&
    String(word?.en || "")
      .trim()
      .toLowerCase()
      .startsWith(DISPLAY_WORD_FALLBACK_PREFIX)
  );
}

function findSentenceForToken(token, sentences = []) {
  return (
    sentences.find((sentence) =>
      extractHindiTokens(sentence?.dv)
        .map((sentenceToken) => normalizeHindiToken(sentenceToken))
        .includes(token),
    ) || null
  );
}

export function collectDisplayWordGlossRequests(
  displayWordSet,
  sentences = [],
  baseWordCount = 0,
) {
  const seenTokens = new Set();

  return (displayWordSet?.word_set || [])
    .filter((word) => isUnresolvedDisplayOnlyWord(word, baseWordCount))
    .map((word) => normalizeHindiToken(word?.dv))
    .filter((token) => token && !seenTokens.has(token) && seenTokens.add(token))
    .map((token) => {
      const sentence = findSentenceForToken(token, sentences);

      if (!sentence) {
        return null;
      }

      return {
        dv: token,
        sentence_dv: sentence.dv,
        sentence_en: sentence.en,
      };
    })
    .filter(Boolean);
}

function formatSchemaIssues(issues) {
  return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
}

function validateDisplayTokenGlossSet(value, requestedItems) {
  const parsed = llmDisplayTokenGlossSetSchema.safeParse(value);

  if (!parsed.success) {
    throw new AppError(
      "The generated display-word glosses did not match the expected shape.",
      {
        code: "invalid_display_word_glosses",
        stage: "display_word_gloss_enrichment",
        details: formatSchemaIssues(parsed.error.issues),
        source: "openai",
      },
    );
  }

  const requestedTokens = new Set(
    requestedItems.map((item) => normalizeHindiToken(item?.dv)).filter(Boolean),
  );
  const seenTokens = new Set();

  return {
    items: parsed.data.items
      .map((item) => ({
        dv: normalizeHindiToken(item?.dv),
        en: String(item?.en || "").trim(),
      }))
      .filter(
        (item) =>
          item.dv &&
          item.en &&
          requestedTokens.has(item.dv) &&
          !seenTokens.has(item.dv) &&
          seenTokens.add(item.dv),
      ),
  };
}

export async function enrichDisplayWordGlosses(requestedItems) {
  if (!requestedItems.length) {
    return { items: [] };
  }

  return requestModelJson({
    buildPrompt: () =>
      buildDisplayTokenGlossPrompt({
        itemsJson: JSON.stringify(requestedItems, null, 2),
      }),
    schema: llmDisplayTokenGlossSetSchema,
    stage: "display_word_gloss_enrichment",
    validate: (value) => validateDisplayTokenGlossSet(value, requestedItems),
  });
}

export function applyDisplayWordGlosses(
  displayWordSet,
  glossItems,
  baseWordCount = 0,
) {
  if (!displayWordSet?.word_set?.length || !glossItems.length) {
    return displayWordSet;
  }

  const glossByToken = new Map(
    glossItems
      .map((item) => [normalizeHindiToken(item?.dv), String(item?.en || "").trim()])
      .filter(([token, gloss]) => token && gloss),
  );
  let didUpdate = false;

  const nextWordSet = displayWordSet.word_set.map((word) => {
    const token = normalizeHindiToken(word?.dv);
    const nextGloss = glossByToken.get(token);

    if (!nextGloss || !isUnresolvedDisplayOnlyWord(word, baseWordCount)) {
      return word;
    }

    didUpdate = true;

    return {
      ...word,
      en: nextGloss,
    };
  });

  return didUpdate ? { word_set: nextWordSet } : displayWordSet;
}

export async function generateSentenceLevel(wordSet, sentenceCount, options = {}) {
  const {
    previousSentences = null,
    retryOnLowValidCount = DEFAULT_RETRY_ON_LOW_VALID_COUNT,
  } = options;
  const allowedTokenSet = buildAllowedHindiTokenSet(wordSet);
  const candidateCount = getInitialSentenceCandidateCount(sentenceCount);
  const stage = normalizePreviousSentenceList(previousSentences).length
    ? "regenerate_sentence_level"
    : "generate_sentence_level";
  const firstPass = await requestSentenceCandidates({
    wordSet,
    sentenceCount: candidateCount,
    previousSentences,
    stage,
    allowPartial: true,
  });

  let generatedSentences = [...firstPass.sentences];
  let { valid, invalid } = classifySentences(
    firstPass.sentences,
    allowedTokenSet,
    previousSentences,
  );

  if (shouldRetrySentenceTopUp(valid.length, sentenceCount, retryOnLowValidCount)) {
    let topUpAttempts = 0;

    while (valid.length < sentenceCount && topUpAttempts < MAX_SENTENCE_TOP_UP_ATTEMPTS) {
      const remaining = sentenceCount - valid.length;
      const retryStage = `${stage}_retry_${topUpAttempts + 1}`;
      const retryRequestCount = remaining + EXTRA_SENTENCE_BUFFER;
      const retryPreviousSentences = renumberSentenceSet([
        ...normalizePreviousSentenceList(previousSentences),
        ...generatedSentences,
      ]);

      const retryPass = await requestSentenceCandidates({
        wordSet,
        sentenceCount: retryRequestCount,
        previousSentences: retryPreviousSentences,
        stage: retryStage,
        strictCompliance: true,
        allowPartial: true,
      });
      const retryClassification = classifySentences(
        retryPass.sentences,
        allowedTokenSet,
        retryPreviousSentences,
      );

      generatedSentences = [...generatedSentences, ...retryPass.sentences];
      valid = [...valid, ...retryClassification.valid];
      invalid = [...invalid, ...retryClassification.invalid];
      topUpAttempts += 1;
    }
  }

  const selectedValidSentences = valid.slice(0, sentenceCount);
  const remainingCount = sentenceCount - selectedValidSentences.length;
  const selectedInvalidSentences =
    remainingCount > 0 ? pickFallbackInvalidSentences(invalid, remainingCount) : [];
  const finalSentenceSet = validateSentenceSet(
    {
      sentences: [
        ...selectedValidSentences,
        ...selectedInvalidSentences.map((entry) => entry.sentence),
      ],
    },
    sentenceCount,
  );

  return {
    sentenceSet: renumberSentenceSet(finalSentenceSet.sentences),
    displayWordSet: buildDisplayWordSet(
      wordSet,
      selectedInvalidSentences,
      allowedTokenSet,
    ),
    invalidSentenceSummary: formatInvalidSentenceSummary(selectedInvalidSentences),
  };
}

export async function resolveWordSet(wordList, action, count) {
  const currentWordSet = toWordSet(wordList.currentWordSet);
  const adjustmentCount = clamp(
    coerceInteger(count, DEFAULT_ADJUSTMENT_COUNT),
    1,
    MAX_WORD_COUNT,
  );

  switch (action) {
    case PENDING_ACTIONS.SAME:
    case undefined:
    case null:
      return currentWordSet;

    case PENDING_ACTIONS.RESAMPLE:
      return generateWordList(currentWordSet.word_set.length);

    case PENDING_ACTIONS.ADD: {
      const addLimit = MAX_WORD_COUNT - currentWordSet.word_set.length;

      if (addLimit < 1) {
        return currentWordSet;
      }

      return addWordsToList(
        currentWordSet,
        clamp(adjustmentCount, 1, addLimit),
      );
    }

    case PENDING_ACTIONS.REMOVE: {
      const removeLimit = currentWordSet.word_set.length - MIN_WORD_SET_SIZE;

      if (removeLimit < 1) {
        return currentWordSet;
      }

      return removeWordsFromList(
        currentWordSet,
        clamp(adjustmentCount, 1, removeLimit),
      );
    }

    default:
      throw new AppError("Unknown next-level action.", {
        code: "unknown_generation_action",
        stage: "generation",
        details: { action, count },
      });
  }
}

export async function generateLevel(wordList, options = {}) {
  const { action = PENDING_ACTIONS.SAME, count = null, nextWordSet = null, onProgress } = options;
  const resolvedWordSet = nextWordSet || (await resolveWordSet(wordList, action, count));

  if (typeof onProgress === "function") {
    onProgress({
      stage: "sentences",
      message: "Generating sentences...",
    });
  }

  const previousSentences = Array.isArray(wordList.session?.currentLevel?.sentences)
    ? wordList.session.currentLevel.sentences
    : wordList.session?.previousLevelSentences || null;
  const { sentenceSet, displayWordSet } = await generateSentenceLevel(
    resolvedWordSet,
    LEVEL_SIZE,
    { previousSentences },
  );

  let enrichedDisplayWordSet = displayWordSet;
  const requestedItems = collectDisplayWordGlossRequests(
    displayWordSet,
    sentenceSet.sentences,
    resolvedWordSet.word_set.length,
  );

  if (requestedItems.length) {
    if (typeof onProgress === "function") {
      onProgress({
        stage: "display-words",
        message: "Resolving display word glosses...",
      });
    }

    const glossSet = await enrichDisplayWordGlosses(requestedItems);
    enrichedDisplayWordSet = applyDisplayWordGlosses(
      displayWordSet,
      glossSet.items,
      resolvedWordSet.word_set.length,
    );
  }

  return {
    nextWordSet: cloneWordEntries(resolvedWordSet.word_set),
    levelNumber: Number(wordList.session?.levelNumber || 0) + 1,
    currentLevel: {
      sentences: sentenceSet.sentences,
      questions: sentenceSet.sentences.map(buildQuestionOptions),
      answers: [],
      isComplete: false,
      wordCount: resolvedWordSet.word_set.length,
      displayWordSet: enrichedDisplayWordSet,
      nextAction: null,
      nextWordSet: null,
    },
    previousLevel: cloneLevelSnapshot(wordList.session?.currentLevel),
    previousLevelSentences: Array.isArray(wordList.session?.currentLevel?.sentences)
      ? wordList.session.currentLevel.sentences
      : null,
  };
}
