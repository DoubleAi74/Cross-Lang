import { MAX_WORD_COUNT, MIN_WORD_COUNT } from "@/lib/constants";

const CONTROLLED_VERB_SUFFIXES = ["ता", "ती", "ते"];
const COPULA_FORMS = ["है", "हूँ", "हो", "हैं", "था", "थे", "थी"];
const COPULA_SEED_TOKENS = new Set(["होना", ...COPULA_FORMS]);
const CONTROLLED_IMPERATIVE_FORMS = new Map([
  ["आना", ["आओ"]],
  ["जाना", ["जाओ"]],
  ["करना", ["करो"]],
  ["कहना", ["कहो"]],
  ["खाना", ["खाओ"]],
  ["चलना", ["चलो"]],
  ["देखना", ["देखो"]],
  ["देना", ["दो"]],
  ["पढ़ना", ["पढ़ो"]],
  ["पीना", ["पियो"]],
  ["पूछना", ["पूछो"]],
  ["बैठना", ["बैठो"]],
  ["बोलना", ["बोलो"]],
  ["रखना", ["रखो"]],
  ["लेना", ["लो"]],
  ["लिखना", ["लिखो"]],
  ["समझना", ["समझो"]],
  ["सुनना", ["सुनो"]],
  ["सोचना", ["सोचो"]],
]);
const IRREGULAR_ADJECTIVE_AGREEMENT_FORMS = new Map([
  ["अच्छा", ["अच्छी", "अच्छे"]],
  ["छोटा", ["छोटी", "छोटे"]],
  ["थोड़ा", ["थोड़ी", "थोड़े"]],
  ["नया", ["नई", "नए"]],
  ["बड़ा", ["बड़ी", "बड़े"]],
  ["बुरा", ["बुरी", "बुरे"]],
]);
const ADJECTIVE_GLOSS_HINTS = new Set([
  "big",
  "childish",
  "small",
  "good",
  "bad",
  "new",
  "old",
  "own",
  "hot",
  "cold",
  "cheap",
  "expensive",
  "annual",
  "double",
  "happy",
  "pleasant",
  "sad",
  "ready",
  "little",
  "much",
  "many",
  "large",
  "long",
  "short",
  "fast",
  "slow",
  "deserted",
]);
const NON_VERB_NA_TOKENS = new Set([
  "अपना",
  "उत्तेजना",
  "कितना",
  "कल्पना",
  "कामना",
  "कोना",
  "खिलौना",
  "गणना",
  "गाना",
  "झरना",
  "टखना",
  "दाना",
  "दुर्घटना",
  "दोष-भावना",
  "ना",
  "नमूना",
  "नाना",
  "पहना",
  "पुराना",
  "प्रार्थना",
  "प्रस्तावना",
  "बहाना",
  "बना",
  "बिना",
  "मना",
  "महीना",
  "योजना",
  "रचना",
  "सेना",
  "सूचना",
  "सुना",
  "सपना",
  "संभावना",
  "पैमाना",
]);
const DEVANAGARI_TOKEN_SEGMENT = "[\\u0900-\\u0963\\u0966-\\u097F]+";
const HINDI_TOKEN_REGEX = new RegExp(
  `${DEVANAGARI_TOKEN_SEGMENT}(?:-${DEVANAGARI_TOKEN_SEGMENT})*`,
  "g",
);
const SENTENCE_LENGTH_CURVE = Object.freeze({
  exponent: 1.15,
  scale: 3.1,
  rate: 0.12,
  rangeRatio: 0.5,
});

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeEnglishGloss(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ");
}

function englishGlossHasHint(gloss, hints) {
  const normalizedGloss = normalizeEnglishGloss(gloss);

  if (!normalizedGloss) {
    return false;
  }

  return normalizedGloss.split(" ").some((part) => hints.has(part));
}

function normalizeSentenceLengthWordCount(wordCount) {
  return clampNumber(
    Number.isFinite(wordCount) ? wordCount : MIN_WORD_COUNT,
    MIN_WORD_COUNT,
    MAX_WORD_COUNT,
  );
}

function calculateTargetSentenceLengthMean(wordCount) {
  const safeWordCount = normalizeSentenceLengthWordCount(wordCount);

  return (
    SENTENCE_LENGTH_CURVE.scale *
    Math.pow(
      Math.log1p(SENTENCE_LENGTH_CURVE.rate * safeWordCount),
      SENTENCE_LENGTH_CURVE.exponent,
    )
  );
}

function formatSentenceLengthNumber(value) {
  return Number(value.toFixed(1)).toString();
}

function isLikelyAdjectiveLikeWord(token, englishGloss) {
  if (!token) {
    return false;
  }

  if (IRREGULAR_ADJECTIVE_AGREEMENT_FORMS.has(token)) {
    return true;
  }

  return (
    token.endsWith("ा") &&
    englishGlossHasHint(englishGloss, ADJECTIVE_GLOSS_HINTS)
  );
}

function deriveAdjectiveAgreementForms(token, englishGloss) {
  const irregularForms = IRREGULAR_ADJECTIVE_AGREEMENT_FORMS.get(token);

  if (irregularForms?.length) {
    return irregularForms;
  }

  if (!isLikelyAdjectiveLikeWord(token, englishGloss) || !token.endsWith("ा")) {
    return [];
  }

  const stem = token.slice(0, -1);
  return stem ? [`${stem}ी`, `${stem}े`] : [];
}

function shouldDeriveControlledVerbForms(token, englishGloss) {
  return (
    token.endsWith("ना") &&
    token.length > 2 &&
    !token.includes("-") &&
    !isLikelyAdjectiveLikeWord(token, englishGloss) &&
    !NON_VERB_NA_TOKENS.has(token)
  );
}

export function normalizeHindiText(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function extractHindiTokens(value) {
  return normalizeHindiText(value).match(HINDI_TOKEN_REGEX) || [];
}

export function normalizeHindiToken(value) {
  const tokens = extractHindiTokens(value);
  return tokens.length === 1 ? tokens[0] : "";
}

export function deriveControlledHindiTokens(wordOrToken, englishGloss = "") {
  const normalized =
    typeof wordOrToken === "string"
      ? normalizeHindiToken(wordOrToken)
      : normalizeHindiToken(wordOrToken?.dv);
  const normalizedGloss =
    typeof wordOrToken === "string"
      ? normalizeEnglishGloss(englishGloss)
      : normalizeEnglishGloss(wordOrToken?.en);
  const derived = new Set();

  if (!normalized) {
    return derived;
  }

  derived.add(normalized);

  if (shouldDeriveControlledVerbForms(normalized, normalizedGloss)) {
    const stem = normalized.slice(0, -2);

    if (stem) {
      derived.add(stem);
      CONTROLLED_VERB_SUFFIXES.forEach((suffix) => {
        derived.add(`${stem}${suffix}`);
      });
    }

    (CONTROLLED_IMPERATIVE_FORMS.get(normalized) || []).forEach((form) => {
      derived.add(form);
    });
  }

  deriveAdjectiveAgreementForms(normalized, normalizedGloss).forEach((form) => {
    derived.add(form);
  });

  if (COPULA_SEED_TOKENS.has(normalized)) {
    derived.add("होना");
    COPULA_FORMS.forEach((form) => derived.add(form));
  }

  return derived;
}

export function buildAllowedHindiTokenMap(wordSet) {
  const words = Array.isArray(wordSet) ? wordSet : wordSet?.word_set || [];
  const tokenMap = new Map();

  words.forEach((word) => {
    const tokens = extractHindiTokens(word?.dv);
    const gloss = String(word?.en || "")
      .trim()
      .toLowerCase()
      .replace(/[.?!]+$/g, "");

    if (!tokens.length) {
      return;
    }

    tokens.forEach((token) => {
      deriveControlledHindiTokens(token, gloss).forEach((allowedToken) => {
        tokenMap.set(allowedToken, gloss || token);
      });
    });
  });

  return tokenMap;
}

export function buildAllowedHindiTokenSet(wordSet) {
  return new Set(buildAllowedHindiTokenMap(wordSet).keys());
}

export function getSentenceLengthProfile(wordCount) {
  const safeWordCount = normalizeSentenceLengthWordCount(wordCount);
  const targetMean = calculateTargetSentenceLengthMean(safeWordCount);
  const minLength = Math.max(
    1,
    Math.round(targetMean * (1 - SENTENCE_LENGTH_CURVE.rangeRatio)),
  );
  const maxLength = Math.max(
    minLength + 1,
    Math.round(targetMean * (1 + SENTENCE_LENGTH_CURVE.rangeRatio)),
  );

  return {
    wordCount: safeWordCount,
    targetAverage: Math.round(targetMean),
    targetMean,
    minLength,
    maxLength,
  };
}

export function buildSentenceLengthGuidance(wordCount) {
  const profile = getSentenceLengthProfile(wordCount);

  return `- Active word count: ${profile.wordCount}
- Target mean sentence length: about ${formatSentenceLengthNumber(profile.targetMean)} Hindi words
- Keep most sentences between ${profile.minLength} and ${profile.maxLength} Hindi words
- Use some shorter and some longer sentences within that range
- Keep lengths clustered around the target mean
- Do not make all sentences the same length`;
}
