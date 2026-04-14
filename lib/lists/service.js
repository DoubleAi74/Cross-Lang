import mongoose from "mongoose";
import clientPromise from "@/lib/db/mongodb";
import { connectMongoose } from "@/lib/db/mongoose";
import { generateWordList } from "@/lib/corpus/sampler";
import { deleteAudioObject } from "@/lib/storage/r2";
import { createSlug, withNumericSlugSuffix } from "@/lib/slugs";
import { getKnownWordKey } from "@/lib/utils";
import {
  ValidationError,
  validateCreateWordListInput,
  validateKnownWordsInput,
  validatePreferencesInput,
  validateResetWordListInput,
  validateSessionInput,
  validateUpdateWordListInput,
} from "@/lib/lists/validators";
import WordList from "@/models/WordList";

function createNotFoundError() {
  return Object.assign(new Error("Word list not found"), { code: "NOT_FOUND" });
}

function createForbiddenError() {
  return Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
}

function buildEmptySession() {
  return {
    levelNumber: 0,
    currentLevel: null,
    previousLevel: null,
    previousLevelSentences: null,
  };
}

function cloneWordEntries(entries = []) {
  return entries.map((entry) => ({
    rk: entry.rk ?? null,
    dv: entry.dv,
    rm: entry.rm,
    en: entry.en,
  }));
}

async function ensureUniqueSlug(userId, baseSlug, excludeId = null) {
  let index = 1;
  let slug = withNumericSlugSuffix(baseSlug, index);

  while (true) {
    const query = { userId, slug };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await WordList.findOne(query).select("_id").lean();

    if (!existing) {
      return slug;
    }

    index += 1;
    slug = withNumericSlugSuffix(baseSlug, index);
  }
}

async function getWordListDocument(id) {
  await connectMongoose();

  if (!mongoose.isValidObjectId(id)) {
    throw createNotFoundError();
  }

  const wordList = await WordList.findById(id);

  if (!wordList) {
    throw createNotFoundError();
  }

  return wordList;
}

async function getOwnedWordList(id, userId) {
  const wordList = await getWordListDocument(id);

  if (wordList.userId.toString() !== userId.toString()) {
    throw createForbiddenError();
  }

  return wordList;
}

function toUserObjectId(userId) {
  if (userId instanceof mongoose.Types.ObjectId) {
    return userId;
  }

  return new mongoose.Types.ObjectId(userId);
}

export async function listWordLists(userId) {
  await connectMongoose();

  return WordList.aggregate([
    { $match: { userId: toUserObjectId(userId) } },
    { $sort: { updatedAt: -1 } },
    {
      $project: {
        name: 1,
        slug: 1,
        language: 1,
        source: 1,
        wordCount: { $size: "$currentWordSet" },
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
}

export async function createWordList(userId, input) {
  await connectMongoose();

  const cleaned = validateCreateWordListInput(input);
  const generatedWordSet = await generateWordList(cleaned.wordCount);
  const originalWordSet = cloneWordEntries(generatedWordSet.word_set);
  const currentWordSet = cloneWordEntries(generatedWordSet.word_set);
  const baseSlug = createSlug(cleaned.name, "list");
  const slug = await ensureUniqueSlug(userId, baseSlug);

  return WordList.create({
    userId,
    name: cleaned.name,
    slug,
    language: "hindi",
    originalWordSet,
    currentWordSet,
    knownWordKeys: [],
    showRomanization: true,
    session: buildEmptySession(),
  });
}

export async function createAudioWordList(userId, input) {
  await connectMongoose();

  const cleanedName = String(input?.name || "").trim();

  if (!cleanedName) {
    throw new ValidationError("name", "Name is required");
  }

  if (cleanedName.length > 120) {
    throw new ValidationError("name", "Name must be 120 characters or fewer");
  }

  const sentences = Array.isArray(input?.sentences) ? input.sentences : [];

  if (!sentences.length) {
    throw new ValidationError("sentences", "Sentences are required");
  }

  const originalWordSet = cloneWordEntries(input.wordEntries || []);
  const currentWordSet = cloneWordEntries(input.wordEntries || []);
  const baseSlug = createSlug(cleanedName, "list");
  const slug = await ensureUniqueSlug(userId, baseSlug);

  return WordList.create({
    userId,
    name: cleanedName,
    slug,
    language: "hindi",
    source: "audio",
    audioKey: input?.audioKey || null,
    audioFileName: input?.audioFileName || null,
    originalWordSet,
    currentWordSet,
    knownWordKeys: [],
    showRomanization: true,
    sentences,
    storyMetadata: input?.storyMetadata || null,
    session: buildEmptySession(),
  });
}

export async function getWordList(id, userId) {
  return getOwnedWordList(id, userId);
}

export async function getWordListByUserSlug(userId, slug) {
  await connectMongoose();

  if (!slug) {
    throw createNotFoundError();
  }

  const wordList = await WordList.findOne({
    userId: toUserObjectId(userId),
    slug,
  });

  if (!wordList) {
    throw createNotFoundError();
  }

  return wordList;
}

export async function updateWordList(id, userId, fields) {
  const wordList = await getOwnedWordList(id, userId);
  const cleaned = validateUpdateWordListInput(fields);

  if (cleaned.name !== undefined && cleaned.name !== wordList.name) {
    wordList.name = cleaned.name;
    const baseSlug = createSlug(cleaned.name, "list");
    wordList.slug = await ensureUniqueSlug(wordList.userId, baseSlug, wordList._id);
  }

  if (!wordList.isModified()) {
    return wordList;
  }

  return wordList.save();
}

export async function deleteWordList(id, userId) {
  const wordList = await getOwnedWordList(id, userId);

  if (wordList.audioKey) {
    await deleteAudioObject(wordList.audioKey);
  }

  await wordList.deleteOne();
}

export async function getWordListBySlug(username, slug) {
  await connectMongoose();

  if (!username || !slug) {
    return null;
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const user = await db.collection("users").findOne({ username });

  if (!user) {
    return null;
  }

  return WordList.findOne({ userId: user._id, slug });
}

export async function updateSession(id, userId, sessionData) {
  const wordList = await getOwnedWordList(id, userId);
  const cleaned = validateSessionInput(sessionData);
  const setFields = {};

  if (cleaned.levelNumber !== undefined) {
    setFields["session.levelNumber"] = cleaned.levelNumber;
  }

  if (cleaned.currentLevel !== undefined) {
    setFields["session.currentLevel"] = cleaned.currentLevel;
  }

  if (cleaned.previousLevel !== undefined) {
    setFields["session.previousLevel"] = cleaned.previousLevel;
  }

  if (cleaned.previousLevelSentences !== undefined) {
    setFields["session.previousLevelSentences"] = cleaned.previousLevelSentences;
  }

  if (cleaned.currentWordSet !== undefined) {
    setFields.currentWordSet = cloneWordEntries(cleaned.currentWordSet);
  }

  if (!Object.keys(setFields).length) {
    return wordList;
  }

  return WordList.findByIdAndUpdate(
    wordList._id,
    { $set: setFields },
    { new: true },
  );
}

export async function updateKnownWords(id, userId, action, wordKey, known) {
  const wordList = await getOwnedWordList(id, userId);
  const cleaned = validateKnownWordsInput({ action, wordKey, known });

  if (cleaned.action === "reset") {
    wordList.knownWordKeys = [];
    return wordList.save();
  }

  const normalizedWordKey = getKnownWordKey(cleaned.wordKey);

  if (!normalizedWordKey) {
    throw new ValidationError("wordKey", "Word key is required");
  }

  if (cleaned.action === "set") {
    if (cleaned.known) {
      if (!wordList.knownWordKeys.includes(normalizedWordKey)) {
        wordList.knownWordKeys = [...wordList.knownWordKeys, normalizedWordKey];
      }
    } else {
      wordList.knownWordKeys = wordList.knownWordKeys.filter(
        (entry) => entry !== normalizedWordKey,
      );
    }
  } else if (wordList.knownWordKeys.includes(normalizedWordKey)) {
    wordList.knownWordKeys = wordList.knownWordKeys.filter(
      (entry) => entry !== normalizedWordKey,
    );
  } else {
    wordList.knownWordKeys = [...wordList.knownWordKeys, normalizedWordKey];
  }

  return wordList.save();
}

export async function updatePreferences(id, userId, prefs) {
  const wordList = await getOwnedWordList(id, userId);
  const cleaned = validatePreferencesInput(prefs);

  wordList.showRomanization = cleaned.showRomanization;
  return wordList.save();
}

export async function resetWordList(id, userId, options) {
  const wordList = await getOwnedWordList(id, userId);
  const cleaned = validateResetWordListInput(options);

  if (cleaned.resetWordList) {
    wordList.currentWordSet = cloneWordEntries(wordList.originalWordSet);
    wordList.session = buildEmptySession();
  }

  if (cleaned.resetKnownWords) {
    wordList.knownWordKeys = [];
  }

  return wordList.save();
}

export async function countUserLists(userId) {
  await connectMongoose();
  return WordList.countDocuments({ userId });
}
