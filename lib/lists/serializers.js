function serializeSentence(sentence) {
  return {
    id: sentence.id,
    devanagari: sentence.devanagari,
    transliteration: sentence.transliteration,
    english: sentence.english,
    tokens: Array.isArray(sentence.tokens)
      ? sentence.tokens.map((token) => ({
          word: token.word,
          transliteration: token.transliteration,
          meaning: token.meaning,
        }))
      : [],
  };
}

function serializeStoryMetadata(meta) {
  return {
    title: meta.title
      ? {
          devanagari: meta.title.devanagari || "",
          transliteration: meta.title.transliteration || "",
          english: meta.title.english || "",
        }
      : null,
    level: meta.level || null,
    storyId: meta.storyId || null,
  };
}

function serializeTimestamp(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeWordEntry(entry) {
  return {
    rk: entry.rk,
    dv: entry.dv,
    rm: entry.rm,
    en: entry.en,
  };
}

function serializeWordEntries(entries = []) {
  return Array.isArray(entries) ? entries.map(serializeWordEntry) : [];
}

function serializeSession(session) {
  if (session === undefined || session === null) {
    return {
      levelNumber: 0,
      currentLevel: null,
      previousLevel: null,
      previousLevelSentences: null,
    };
  }

  return typeof session.toObject === "function" ? session.toObject() : session;
}

function resolveWordCount(doc) {
  if (typeof doc.wordCount === "number") {
    return doc.wordCount;
  }

  return Array.isArray(doc.currentWordSet) ? doc.currentWordSet.length : 0;
}

export function serializeListMeta(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    language: doc.language,
    source: doc.source || "corpus",
    wordCount: resolveWordCount(doc),
    createdAt: serializeTimestamp(doc.createdAt),
    updatedAt: serializeTimestamp(doc.updatedAt),
  };
}

export function serializeList(doc, options = {}) {
  return {
    ...serializeListMeta(doc),
    currentWordSet: serializeWordEntries(doc.currentWordSet),
    originalWordCount: Array.isArray(doc.originalWordSet)
      ? doc.originalWordSet.length
      : 0,
    knownWordKeys: Array.isArray(doc.knownWordKeys) ? [...doc.knownWordKeys] : [],
    showRomanization: Boolean(doc.showRomanization),
    session: serializeSession(doc.session),
    audioUrl: options.audioUrl || null,
    audioFileName: doc.audioFileName || null,
    sentences: doc.sentences ? doc.sentences.map(serializeSentence) : null,
    storyMetadata: doc.storyMetadata
      ? serializeStoryMetadata(doc.storyMetadata)
      : null,
  };
}

export function serializePublicList(doc, options = {}) {
  return {
    ...serializeListMeta(doc),
    currentWordSet: serializeWordEntries(doc.currentWordSet),
    audioUrl: options.audioUrl || null,
    audioFileName: doc.audioFileName || null,
    sentences: doc.sentences ? doc.sentences.map(serializeSentence) : null,
    storyMetadata: doc.storyMetadata
      ? serializeStoryMetadata(doc.storyMetadata)
      : null,
  };
}
