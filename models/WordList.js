import mongoose from "mongoose";

const wordEntrySchema = new mongoose.Schema(
  {
    rk: { type: Number, default: null },
    dv: { type: String, required: true },
    rm: { type: String, required: true },
    en: { type: String, required: true },
  },
  { _id: false },
);

const sentenceTokenSchema = new mongoose.Schema(
  {
    word: { type: String, required: true },
    transliteration: { type: String, required: true },
    meaning: { type: String, required: true },
  },
  { _id: false },
);

const sentenceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    devanagari: { type: String, required: true },
    transliteration: { type: String, required: true },
    english: { type: String, required: true },
    tokens: {
      type: [sentenceTokenSchema],
      default: [],
    },
  },
  { _id: false },
);

const storyMetadataSchema = new mongoose.Schema(
  {
    title: {
      devanagari: { type: String },
      transliteration: { type: String },
      english: { type: String },
    },
    level: { type: String },
    storyId: { type: String },
  },
  { _id: false },
);

const currentLevelSchema = new mongoose.Schema(
  {
    sentences: { type: Array, default: [] },
    questions: { type: Array, default: [] },
    answers: { type: Array, default: [] },
    isComplete: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },
    displayWordSet: { type: mongoose.Schema.Types.Mixed, default: null },
    nextAction: { type: mongoose.Schema.Types.Mixed, default: null },
    nextWordSet: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema(
  {
    levelNumber: { type: Number, default: 0 },
    currentLevel: { type: currentLevelSchema, default: null },
    previousLevel: { type: currentLevelSchema, default: null },
    previousLevelSentences: { type: Array, default: null },
  },
  { _id: false },
);

const wordListSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      maxlength: 80,
    },
    language: {
      type: String,
      default: "hindi",
    },
    originalWordSet: {
      type: [wordEntrySchema],
      required: true,
    },
    currentWordSet: {
      type: [wordEntrySchema],
      required: true,
    },
    knownWordKeys: {
      type: [String],
      default: [],
    },
    showRomanization: {
      type: Boolean,
      default: true,
    },
    session: {
      type: sessionSchema,
      default: () => ({
        levelNumber: 0,
        currentLevel: null,
        previousLevel: null,
        previousLevelSentences: null,
      }),
    },
    source: {
      type: String,
      enum: ["corpus", "audio"],
      default: "corpus",
    },
    audioKey: {
      type: String,
      default: null,
    },
    audioFileName: {
      type: String,
      maxlength: 255,
      default: null,
    },
    sentences: {
      type: [sentenceSchema],
      default: null,
    },
    storyMetadata: {
      type: storyMetadataSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

wordListSchema.index({ userId: 1, updatedAt: -1 });
wordListSchema.index({ userId: 1, slug: 1 }, { unique: true, sparse: true });

export default mongoose.models.WordList ||
  mongoose.model("WordList", wordListSchema);
