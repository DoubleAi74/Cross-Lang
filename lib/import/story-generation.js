const RESPONSES_URL = "https://api.openai.com/v1/responses";
const STORY_CHUNK_SIZE = 7;
const STORY_MODEL = "gpt-4o-mini";

const TOKEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    word: { type: "string" },
    transliteration: { type: "string" },
    meaning: { type: "string" },
  },
  required: ["word", "transliteration", "meaning"],
};

const STORY_CHUNK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          line_number: { type: "integer", minimum: 1 },
          input_line: { type: "string" },
          devanagari: { type: "string" },
          transliteration: { type: "string" },
          english: { type: "string" },
          tokens: {
            type: "array",
            items: TOKEN_SCHEMA,
          },
        },
        required: [
          "line_number",
          "input_line",
          "devanagari",
          "transliteration",
          "english",
          "tokens",
        ],
      },
    },
  },
  required: ["sentences"],
};

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for story generation.");
  }

  return apiKey;
}

export async function generateStoryJson({
  lines,
  onProgress,
  onChunkComplete,
}) {
  const normalizedTranscriptLines = normalizeTranscriptLineInput(lines);
  const transcriptTexts = normalizedTranscriptLines.map((line) => line.text);
  const trimmedTranscript = transcriptTexts.join("\n").trim();

  if (!trimmedTranscript) {
    throw new Error("Create a Hindi transcript before generating story JSON.");
  }

  const chunks = chunkArray(normalizedTranscriptLines, STORY_CHUNK_SIZE).map(
    (chunkLines, chunkIndex) => ({
      chunkIndex,
      startLineNumber: chunkIndex * STORY_CHUNK_SIZE + 1,
      endLineNumber: chunkIndex * STORY_CHUNK_SIZE + chunkLines.length,
      lines: chunkLines,
    }),
  );

  notifyProgress(onProgress, {
    mode: "chunking",
    title: `Preparing ${chunks.length} chunk${chunks.length === 1 ? "" : "s"}`,
    detail: `${transcriptTexts.length} transcript line${transcriptTexts.length === 1 ? "" : "s"} will be processed in blocks of up to ${STORY_CHUNK_SIZE}, and completed chunks will appear as they finish.`,
    completed: 0,
    total: Math.max(chunks.length, 1),
  });

  const mergedSentences = [];

  for (const chunk of chunks) {
    notifyProgress(onProgress, {
      mode: "chunking",
      title: `Processing chunk ${chunk.chunkIndex + 1} of ${chunks.length}`,
      detail: `Generating lines ${chunk.startLineNumber}-${chunk.endLineNumber}. Completed chunks will appear below as soon as this block is ready.`,
      completed: chunk.chunkIndex,
      total: chunks.length,
    });

    const chunkSentences = await generateChunkWithRecovery({
      chunk,
      totalChunks: chunks.length,
      totalLines: transcriptTexts.length,
      onProgress,
    });

    mergedSentences.push(...chunkSentences);

    notifyChunkComplete(onChunkComplete, {
      mergedSentences,
      completedChunks: chunk.chunkIndex + 1,
      totalChunks: chunks.length,
    });
  }

  notifyProgress(onProgress, {
    mode: "metadata",
    title: "Finalizing story metadata",
    detail:
      "Building the title and difficulty locally from the completed Hindi lines.",
    completed: chunks.length,
    total: Math.max(chunks.length, 1),
  });

  const storyMetadata = buildFallbackStoryMetadata(
    mergedSentences,
    transcriptTexts,
  );

  return {
    story: {
      id: storyMetadata.id,
      title: storyMetadata.title,
      level: storyMetadata.level,
      source: "HindiTranscript",
      sentence_count: mergedSentences.length,
    },
    sentences: mergedSentences.map((sentence, index) => ({
      id: index + 1,
      devanagari: sentence.devanagari,
      transliteration: sentence.transliteration,
      english: sentence.english,
      tokens: sentence.tokens,
    })),
  };
}

async function generateChunkWithRecovery({
  chunk,
  totalChunks,
  totalLines,
  onProgress,
}) {
  let latestValidation = createFailedValidation(
    chunk,
    "Chunk generation did not start.",
  );

  try {
    const initialPayload = await requestStoryChunk({
      chunk,
      mode: "initial",
    });

    latestValidation = validateChunkPayload(initialPayload, chunk);

    if (latestValidation.ok) {
      return latestValidation.sentences;
    }
  } catch (error) {
    latestValidation = createFailedValidation(
      chunk,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (latestValidation.shouldRetryChunk) {
    notifyProgress(onProgress, {
      mode: "chunk_repair",
      title: `Repairing chunk ${chunk.chunkIndex + 1} of ${totalChunks}`,
      detail:
        "This block came back malformed, so it is being regenerated once before falling back to focused line repair.",
      completed: chunk.chunkIndex + 1,
      total: totalChunks,
    });

    try {
      const repairedPayload = await requestStoryChunk({
        chunk,
        mode: "repair",
        issues: latestValidation.issues,
      });

      latestValidation = validateChunkPayload(repairedPayload, chunk);

      if (latestValidation.ok) {
        return latestValidation.sentences;
      }
    } catch {
      // Keep the latest validation we already had and fall back to per-line repair.
    }
  }

  const invalidLineIndices = latestValidation.invalidLineIndices.length
    ? latestValidation.invalidLineIndices
    : chunk.lines.map((_, index) => index);

  notifyProgress(onProgress, {
    mode: "line_repair",
    title: `Repairing lines in chunk ${chunk.chunkIndex + 1} of ${totalChunks}`,
    detail: `Falling back to focused line-by-line repair for ${invalidLineIndices.length} line${invalidLineIndices.length === 1 ? "" : "s"} while keeping completed chunks on screen.`,
    completed: chunk.chunkIndex + 1,
    total: totalChunks,
  });

  return repairInvalidLines({
    chunk,
    invalidLineIndices,
    seedSentences: latestValidation.sentences,
    totalChunks,
    totalLines,
    onProgress,
  });
}

async function repairInvalidLines({
  chunk,
  invalidLineIndices,
  seedSentences,
  totalChunks,
  totalLines,
  onProgress,
}) {
  const repairedSentences = [...seedSentences];
  let completedRepairs = 0;

  await Promise.all(
    invalidLineIndices.map(async (invalidIndex) => {
      const lineNumber = chunk.startLineNumber + invalidIndex;

      const repairedSentence = await generateSingleLineWithRetry({
        line: chunk.lines[invalidIndex],
        lineNumber,
      });

      repairedSentences[invalidIndex] = repairedSentence;
      completedRepairs += 1;

      notifyProgress(onProgress, {
        mode: "line_repair",
        title: `Repairing lines in chunk ${chunk.chunkIndex + 1} of ${totalChunks}`,
        detail: `Completed ${completedRepairs} of ${invalidLineIndices.length} focused repairs for lines ${chunk.startLineNumber}-${chunk.endLineNumber}.`,
        completed: completedRepairs,
        total: invalidLineIndices.length,
      });
    }),
  );

  return repairedSentences;
}

async function generateSingleLineWithRetry({ line, lineNumber }) {
  const singleLineChunk = {
    chunkIndex: 0,
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    lines: [line],
  };

  let latestValidation = createFailedValidation(
    singleLineChunk,
    "Line repair did not start.",
  );

  for (const mode of ["line_repair", "line_repair_retry"]) {
    try {
      const payload = await requestStoryChunk({
        chunk: singleLineChunk,
        mode,
        issues: latestValidation.issues,
      });

      latestValidation = validateChunkPayload(payload, singleLineChunk);

      if (latestValidation.ok) {
        return latestValidation.sentences[0];
      }
    } catch (error) {
      latestValidation = createFailedValidation(
        singleLineChunk,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  throw new Error(
    `Line ${lineNumber} could not be repaired after multiple attempts.`,
  );
}

async function requestStoryChunk({ chunk, mode, issues = [] }) {
  const linesPayload = chunk.lines.map((line, index) => ({
    line_number: chunk.startLineNumber + index,
    text: line.text,
  }));

  const issueSummary = issues.length
    ? `\n\nValidation issues from the previous attempt:\n${issues
        .slice(0, 12)
        .map((issue) => `- ${issue}`)
        .join("\n")}`
    : "";

  return callResponsesJsonSchema({
    model: STORY_MODEL,
    temperature: mode === "initial" ? 0.2 : 0,
    instructions: buildChunkInstructions(mode),
    input: `Input lines JSON:\n${JSON.stringify(
      { lines: linesPayload },
      null,
      2,
    )}${issueSummary}`,
    schemaName: "hindi_story_chunk",
    schemaDescription:
      "Chunked Hindi transcript data with exact input lines, translations, and robust token coverage.",
    schema: STORY_CHUNK_SCHEMA,
  });
}

async function callResponsesJsonSchema({
  model,
  temperature,
  instructions,
  input,
  schemaName,
  schemaDescription,
  schema,
}) {
  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      temperature,
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          description: schemaDescription,
          strict: true,
          schema,
        },
      },
    }),
  });

  const rawText = await response.text();
  const data = tryParseJson(rawText);

  if (!response.ok) {
    throw new Error(formatApiError(response.status, data, rawText));
  }

  const refusal = extractRefusal(data);

  if (refusal) {
    throw new Error(refusal);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("The story JSON call returned an empty response.");
  }

  const parsed = tryParseJson(outputText);

  if (!parsed) {
    throw new Error("The story JSON response could not be parsed.");
  }

  return parsed;
}

function buildChunkInstructions(mode) {
  const baseInstruction = `You are an expert Hindi linguistic analysis tool. Process the Hindi text line-by-line and generate a structured JSON output.

Your entire response MUST be a single valid JSON object with this top-level shape:
{
  "sentences": [
    {
      "line_number": 1,
      "input_line": "...",
      "devanagari": "...",
      "transliteration": "...",
      "english": "...",
      "tokens": [
        {
          "word": "...",
          "transliteration": "...",
          "meaning": "..."
        }
      ]
    }
  ]
}

Each item in "sentences" must represent exactly one input line, in the same order as the input.

Each sentence object must contain these keys:
1. "line_number": (Integer) The exact line number from the input.
2. "input_line": (String) The original Hindi input line copied exactly, with no edits.
3. "devanagari": (String) The Hindi line in Devanagari, preserving the meaning of the input. Only make very light punctuation or spacing cleanup if clearly needed.
4. "transliteration": (String) A simple learner-friendly Latin transliteration of the Hindi line.
5. "english": (String) A fluent, natural English translation of the line.
6. "tokens": (Array of Objects) A token-by-token or phrase-by-phrase breakdown in reading order. Each token object must contain:
   - "word": the Hindi word or grouped phrase
   - "transliteration": the learner-friendly transliteration for that token
   - "meaning": a short English meaning

Token rules:
- Tokens must stay in reading order.
- Tokens must cover the meaningful words or grouped phrases across the whole line.
- Grouped tokens like "हो गया" are allowed when they are natural.
- Do not omit important words.
- Do not leave a non-empty line with an empty tokens array.
- Do not include standalone punctuation as a token unless it is part of a word-like unit.

Example object for a single line:
{
  "line_number": 1,
  "input_line": "मैं घर जा रहा हूँ।",
  "devanagari": "मैं घर जा रहा हूँ।",
  "transliteration": "Main ghar ja raha hoon.",
  "english": "I am going home.",
  "tokens": [
    { "word": "मैं", "transliteration": "main", "meaning": "I" },
    { "word": "घर", "transliteration": "ghar", "meaning": "home" },
    { "word": "जा रहा हूँ", "transliteration": "ja raha hoon", "meaning": "am going" }
  ]
}

Important considerations:
- Return exactly one sentence object per input line.
- Preserve the original order of the lines.
- line_number must exactly match the provided line number.
- input_line must exactly copy the source line.
- Keep the output learner-friendly, faithful, and conservative.
- Do not add commentary, notes, markdown, or extra keys.`;

  if (mode === "repair") {
    return `${baseInstruction}

This is a repair pass because the previous chunk under-covered some lines. Be stricter about token coverage and make sure each line has a complete token list.`;
  }

  if (mode === "line_repair" || mode === "line_repair_retry") {
    return `${baseInstruction}

You are repairing one focused line at a time. Make the token list complete and do not skip any meaningful words.`;
  }

  return baseInstruction;
}

function validateChunkPayload(payload, chunk) {
  const expectedLineCount = chunk.lines.length;
  const sentences = new Array(expectedLineCount).fill(null);
  const issues = [];
  const invalidLineIndices = new Set();
  const rawSentences = Array.isArray(payload?.sentences)
    ? payload.sentences
    : null;

  if (!rawSentences || rawSentences.length !== expectedLineCount) {
    issues.push(
      `Expected ${expectedLineCount} sentence item(s), received ${rawSentences ? rawSentences.length : 0}.`,
    );

    return {
      ok: false,
      sentences,
      invalidLineIndices: chunk.lines.map((_, index) => index),
      issues,
      shouldRetryChunk: true,
    };
  }

  for (let index = 0; index < expectedLineCount; index += 1) {
    const sourceLine = chunk.lines[index];
    const expectedLineNumber = chunk.startLineNumber + index;
    const rawSentence = rawSentences[index];
    const validation = validateSentenceRecord(
      rawSentence,
      sourceLine,
      expectedLineNumber,
    );

    if (validation.ok) {
      sentences[index] = validation.sentence;
    } else {
      invalidLineIndices.add(index);
      issues.push(...validation.issues);
    }
  }

  return {
    ok: invalidLineIndices.size === 0,
    sentences,
    invalidLineIndices: [...invalidLineIndices],
    issues,
    shouldRetryChunk: false,
  };
}

function validateSentenceRecord(rawSentence, sourceLine, expectedLineNumber) {
  const issues = [];
  const sourceText = extractTranscriptLineText(sourceLine);

  if (!rawSentence || typeof rawSentence !== "object") {
    issues.push(`Line ${expectedLineNumber}: missing sentence object.`);
    return { ok: false, issues };
  }

  if (rawSentence.line_number !== expectedLineNumber) {
    issues.push(
      `Line ${expectedLineNumber}: line_number was ${rawSentence.line_number}.`,
    );
  }

  if (
    normalizeWhitespace(rawSentence.input_line) !==
    normalizeWhitespace(sourceText)
  ) {
    issues.push(
      `Line ${expectedLineNumber}: input_line did not echo the source line.`,
    );
  }

  const devanagari = cleanTextField(rawSentence.devanagari);
  const transliteration = cleanTextField(rawSentence.transliteration);
  const english = cleanTextField(rawSentence.english);

  if (!devanagari) {
    issues.push(`Line ${expectedLineNumber}: devanagari was empty.`);
  }

  if (!transliteration) {
    issues.push(`Line ${expectedLineNumber}: transliteration was empty.`);
  }

  if (!english) {
    issues.push(`Line ${expectedLineNumber}: english translation was empty.`);
  }

  if (!Array.isArray(rawSentence.tokens) || rawSentence.tokens.length === 0) {
    issues.push(`Line ${expectedLineNumber}: tokens array was empty.`);
    return { ok: false, issues };
  }

  const normalizedTokens = [];

  rawSentence.tokens.forEach((rawToken, tokenIndex) => {
    const word = cleanTextField(rawToken?.word);
    const tokenTransliteration = cleanTextField(rawToken?.transliteration);
    const meaning = cleanTextField(rawToken?.meaning);

    if (!word || !tokenTransliteration || !meaning) {
      issues.push(
        `Line ${expectedLineNumber}: token ${tokenIndex + 1} was missing required fields.`,
      );
      return;
    }

    normalizedTokens.push({
      word,
      transliteration: tokenTransliteration,
      meaning,
    });
  });

  if (normalizedTokens.length !== rawSentence.tokens.length) {
    return { ok: false, issues };
  }

  const sourceUnits = extractWordUnits(sourceText);
  const coverage = calculateTokenCoverage(sourceUnits, normalizedTokens);
  const minimumCoverage = getMinimumCoverageThreshold(sourceUnits.length);

  if (sourceUnits.length > 0 && coverage < minimumCoverage) {
    issues.push(
      `Line ${expectedLineNumber}: token coverage was ${coverage.toFixed(2)} and needed at least ${minimumCoverage.toFixed(2)}.`,
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    sentence: {
      line_number: expectedLineNumber,
      input_line: sourceText,
      devanagari,
      transliteration,
      english,
      tokens: normalizedTokens,
    },
    issues,
  };
}

function createFailedValidation(chunk, message) {
  return {
    ok: false,
    sentences: new Array(chunk.lines.length).fill(null),
    invalidLineIndices: chunk.lines.map((_, index) => index),
    issues: [message],
    shouldRetryChunk: true,
  };
}

function normalizeTranscriptLineInput(lines, transcriptFallback = "") {
  if (Array.isArray(lines)) {
    return lines
      .map((line, index) => {
        const text = cleanTextField(line?.text ?? line);

        if (!text) {
          return null;
        }

        return {
          index: Number.isInteger(line?.index) ? line.index : index + 1,
          text,
        };
      })
      .filter(Boolean);
  }

  return String(transcriptFallback || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanTextField(line))
    .filter(Boolean)
    .map((text, index) => ({
      index: index + 1,
      text,
    }));
}

function extractTranscriptLineText(line) {
  return cleanTextField(line?.text ?? line);
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function calculateTokenCoverage(sourceUnits, tokens) {
  if (!sourceUnits.length) {
    return 1;
  }

  const tokenUnits = tokens.flatMap((token) => extractWordUnits(token.word));

  if (!tokenUnits.length) {
    return 0;
  }

  let matches = 0;
  let searchIndex = 0;

  for (const tokenUnit of tokenUnits) {
    while (
      searchIndex < sourceUnits.length &&
      sourceUnits[searchIndex] !== tokenUnit
    ) {
      searchIndex += 1;
    }

    if (searchIndex < sourceUnits.length) {
      matches += 1;
      searchIndex += 1;
    }
  }

  return matches / sourceUnits.length;
}

function getMinimumCoverageThreshold(sourceUnitCount) {
  if (sourceUnitCount <= 2) {
    return 1;
  }

  if (sourceUnitCount <= 4) {
    return 0.75;
  }

  return 0.65;
}

function extractWordUnits(text) {
  const cleaned = String(text || "")
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return cleaned ? cleaned.split(" ") : [];
}

function buildFallbackStoryMetadata(sentences, transcriptLines) {
  const firstSentence = sentences[0];
  const fallbackDevanagari = shortenText(
    firstSentence?.devanagari || transcriptLines[0] || "Hindi Story",
    4,
  );
  const fallbackTransliteration = shortenText(
    firstSentence?.transliteration || "Hindi Story",
    4,
  );
  const fallbackEnglish = shortenText(
    firstSentence?.english || "Hindi Story",
    4,
  );

  const title = {
    devanagari: fallbackDevanagari,
    transliteration: fallbackTransliteration,
    english: fallbackEnglish,
  };

  return {
    id: createStoryId(title),
    title,
    level: estimateStoryLevel(sentences),
  };
}

function estimateStoryLevel(sentences) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    return "Elementary";
  }

  const averageTokenCount =
    sentences.reduce((total, sentence) => total + sentence.tokens.length, 0) /
    sentences.length;

  if (averageTokenCount <= 4) {
    return "Beginner";
  }

  if (averageTokenCount <= 7) {
    return "Elementary";
  }

  if (averageTokenCount <= 10) {
    return "Intermediate";
  }

  return "Advanced";
}

function createStoryId(title) {
  const source =
    title.transliteration ||
    title.english ||
    title.devanagari ||
    "hindi_story";
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug ? `hindi_${slug}_story` : "hindi_story";
}

function shortenText(text, wordLimit) {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  return words.slice(0, wordLimit).join(" ") || "Hindi Story";
}

function cleanTextField(value) {
  return normalizeWhitespace(String(value || ""));
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function notifyProgress(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function notifyChunkComplete(callback, payload) {
  if (typeof callback === "function") {
    callback({
      completedChunks: payload.completedChunks,
      totalChunks: payload.totalChunks,
      sentences: payload.mergedSentences.map((sentence, index) => ({
        id: index + 1,
        devanagari: sentence.devanagari,
        transliteration: sentence.transliteration,
        english: sentence.english,
        tokens: sentence.tokens,
      })),
    });
  }
}

function tryParseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function formatApiError(status, data, rawText) {
  if (data?.error?.message) {
    return `OpenAI error (${status}): ${data.error.message}`;
  }

  if (typeof data?.message === "string") {
    return `OpenAI error (${status}): ${data.message}`;
  }

  if (rawText.trim()) {
    return `OpenAI error (${status}): ${rawText.trim()}`;
  }

  return `OpenAI error (${status}).`;
}

function extractRefusal(data) {
  const message = Array.isArray(data?.output)
    ? data.output.find((item) => item.type === "message")
    : null;
  const content = Array.isArray(message?.content) ? message.content : [];
  const refusalPart = content.find((part) => part.type === "refusal");

  return refusalPart?.refusal
    ? `OpenAI refusal: ${refusalPart.refusal}`
    : null;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const message = Array.isArray(data?.output)
    ? data.output.find((item) => item.type === "message")
    : null;
  const content = Array.isArray(message?.content) ? message.content : [];
  const textPart = content.find((part) => part.type === "output_text");

  return typeof textPart?.text === "string" ? textPart.text.trim() : "";
}
