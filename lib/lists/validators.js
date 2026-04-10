import { MAX_WORD_COUNT, MIN_WORD_COUNT } from "@/lib/constants";

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeName(name, { required = true } = {}) {
  if (name === undefined) {
    if (!required) {
      return undefined;
    }

    throw new ValidationError("name", "Name is required");
  }

  const cleanedName = String(name).trim();

  if (!cleanedName) {
    throw new ValidationError("name", "Name is required");
  }

  if (cleanedName.length > 120) {
    throw new ValidationError("name", "Name must be 120 characters or fewer");
  }

  return cleanedName;
}

function normalizeWordCount(wordCount) {
  const parsedWordCount =
    typeof wordCount === "string" && wordCount.trim()
      ? Number(wordCount)
      : wordCount;

  if (!Number.isInteger(parsedWordCount)) {
    throw new ValidationError("wordCount", "Word count must be an integer");
  }

  if (parsedWordCount < MIN_WORD_COUNT || parsedWordCount > MAX_WORD_COUNT) {
    throw new ValidationError(
      "wordCount",
      `Word count must be between ${MIN_WORD_COUNT} and ${MAX_WORD_COUNT}`,
    );
  }

  return parsedWordCount;
}

export function validateCreateWordListInput(input = {}) {
  return {
    name: normalizeName(input.name),
    wordCount: normalizeWordCount(input.wordCount),
  };
}

export function validateUpdateWordListInput(input = {}) {
  const cleaned = {};

  if (input.name !== undefined) {
    cleaned.name = normalizeName(input.name);
  }

  return cleaned;
}

export function validateKnownWordsInput(input = {}) {
  if (
    input.action !== "toggle" &&
    input.action !== "reset" &&
    input.action !== "set"
  ) {
    throw new ValidationError(
      "action",
      "Action must be 'toggle', 'set', or 'reset'",
    );
  }

  if (input.action === "toggle" || input.action === "set") {
    const wordKey = String(input.wordKey || "").trim();

    if (!wordKey) {
      throw new ValidationError("wordKey", "Word key is required");
    }

    if (input.action === "set" && typeof input.known !== "boolean") {
      throw new ValidationError("known", "Known must be a boolean");
    }

    return {
      action: input.action,
      wordKey,
      known: input.action === "set" ? input.known : undefined,
    };
  }

  return { action: input.action };
}

export function validatePreferencesInput(input = {}) {
  if (typeof input.showRomanization !== "boolean") {
    throw new ValidationError(
      "showRomanization",
      "Show romanization must be a boolean",
    );
  }

  return {
    showRomanization: input.showRomanization,
  };
}

export function validateSessionInput(input = {}) {
  if (!isPlainObject(input)) {
    throw new ValidationError("session", "Session update must be an object");
  }

  const cleaned = {};

  if (input.levelNumber !== undefined) {
    const levelNumber =
      typeof input.levelNumber === "string" && input.levelNumber.trim()
        ? Number(input.levelNumber)
        : input.levelNumber;

    if (!Number.isInteger(levelNumber) || levelNumber < 0) {
      throw new ValidationError(
        "levelNumber",
        "Level number must be a non-negative integer",
      );
    }

    cleaned.levelNumber = levelNumber;
  }

  if (input.currentLevel !== undefined) {
    if (input.currentLevel !== null && !isPlainObject(input.currentLevel)) {
      throw new ValidationError(
        "currentLevel",
        "Current level must be an object or null",
      );
    }

    cleaned.currentLevel = input.currentLevel;
  }

  if (input.previousLevel !== undefined) {
    if (input.previousLevel !== null && !isPlainObject(input.previousLevel)) {
      throw new ValidationError(
        "previousLevel",
        "Previous level must be an object or null",
      );
    }

    cleaned.previousLevel = input.previousLevel;
  }

  if (input.previousLevelSentences !== undefined) {
    if (
      input.previousLevelSentences !== null &&
      !Array.isArray(input.previousLevelSentences)
    ) {
      throw new ValidationError(
        "previousLevelSentences",
        "Previous level sentences must be an array or null",
      );
    }

    cleaned.previousLevelSentences = input.previousLevelSentences;
  }

  if (input.currentWordSet !== undefined) {
    if (!Array.isArray(input.currentWordSet)) {
      throw new ValidationError(
        "currentWordSet",
        "Current word set must be an array",
      );
    }

    cleaned.currentWordSet = input.currentWordSet;
  }

  return cleaned;
}

export function validateResetWordListInput(input = {}) {
  if (!isPlainObject(input)) {
    throw new ValidationError("resetWordList", "Reset options must be an object");
  }

  const cleaned = {
    resetWordList: Boolean(input.resetWordList),
    resetKnownWords: Boolean(input.resetKnownWords),
  };

  if (!cleaned.resetWordList && !cleaned.resetKnownWords) {
    throw new ValidationError(
      "resetWordList",
      "Select at least one reset option",
    );
  }

  return cleaned;
}
