import { consumeSseStream } from "@/lib/sse";
import { getAudioObject } from "@/lib/storage/r2";

const TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const LINE_BREAK_MODEL = "gpt-4o";
const HARD_CODED_TRANSCRIPTION_PROMPT =
  "This audio is a Hindi song. Transcribe all audible lyrics as completely and faithfully as possible in Devanagari. Prioritize recall and completeness: do not summarize, skip, shorten, or merge away repeated lines, refrains, pickups, or short repeated phrases. Keep the wording close to what is sung. If a word is uncertain, output the closest plausible Devanagari rendering instead of omitting it. Do not translate. Output only the transcription text.";

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for audio transcription.");
  }

  return apiKey;
}

function extractTranscriptDelta(data) {
  if (typeof data?.delta === "string") {
    return data.delta;
  }

  if (typeof data?.text === "string") {
    return data.text;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return "";
}

function extractTranscriptDoneText(data, transcriptText) {
  if (typeof data?.text === "string" && data.text.trim()) {
    return data.text.trim();
  }

  return transcriptText.trim();
}

async function requestTranscriptionStream({
  fileBuffer,
  fileName,
  contentType,
  signal,
  onDelta,
}) {
  const formData = new FormData();
  const audioBlob = new Blob([fileBuffer], {
    type: contentType || "audio/mpeg",
  });

  formData.append("file", audioBlob, fileName || "audio.mp3");
  formData.append("model", TRANSCRIPTION_MODEL);
  formData.append("response_format", "text");
  formData.append("language", "hi");
  formData.append("prompt", HARD_CODED_TRANSCRIPTION_PROMPT);
  formData.append("stream", "true");

  const response = await fetch(TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    const rawText = await response.text();
    const data = tryParseJson(rawText);
    throw new Error(formatApiError(response.status, data, rawText));
  }

  if (!response.body) {
    throw new Error("The transcription stream returned no body.");
  }

  let transcriptText = "";

  await consumeSseStream(response.body, async ({ event, data }) => {
    const eventName =
      event === "message" && typeof data?.type === "string" ? data.type : event;

    if (eventName === "transcript.text.delta") {
      const delta = extractTranscriptDelta(data);

      if (delta) {
        transcriptText += delta;
        onDelta?.(delta, transcriptText);
      }

      return;
    }

    if (eventName === "transcript.text.done") {
      transcriptText = extractTranscriptDoneText(data, transcriptText);
      return;
    }

    if (eventName === "error") {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "OpenAI returned a transcription stream error.",
      );
    }
  });

  if (!transcriptText.trim()) {
    throw new Error("The API returned an empty transcription response.");
  }

  return transcriptText.trim();
}

async function requestLyricLineBreaks(text, signal) {
  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: LINE_BREAK_MODEL,
      store: false,
      temperature: 0,
      input: buildLyricLineBreakPrompt(text),
    }),
    signal,
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
    throw new Error("The lyric line-break call returned an empty response.");
  }

  return outputText;
}

function buildLyricLineBreakPrompt(text) {
  return `Reformat the Hindi text below into clean lyric-style line breaks.

Output each lyric line on its own line, with no blank lines between them.
Do not output anything else — no labels, no headings, no commentary, no markdown, no code fences.

Rules:
- Preserve the original wording as much as possible.
- Break the text into short, natural lyric lines.
- Keep the original order of the text.
- Keep everything in Devanagari.
- Do not translate.

Correction policy:
- Make only minimal, conservative corrections.
- Only correct errors that are obvious and high-confidence.
- Prefer under-correcting to over-correcting.
- Do not creatively rewrite or normalize unusual wording unless clearly necessary.
- If uncertain, leave the text unchanged.

Text:

${text}`;
}

function normalizeStructuredTranscript(text) {
  const normalizedText = normalizeTranscriptText(text);
  const lines = normalizeTranscriptLineInput(null, normalizedText);

  if (!normalizedText || lines.length === 0) {
    throw new Error("The API returned an empty transcription response.");
  }

  return {
    text: normalizedText,
    lines,
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

  return normalizeTranscriptText(transcriptFallback)
    .split("\n")
    .map((line) => cleanTextField(line))
    .filter(Boolean)
    .map((line, index) => ({
      index: index + 1,
      text: line,
    }));
}

function cleanTextField(value) {
  return normalizeWhitespace(String(value || ""));
}

function normalizeTranscriptText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

export async function transcribeAudioFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Choose an audio file before starting transcription.");
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const transcriptionText = await requestTranscriptionStream({
    fileBuffer,
    fileName: file?.name,
    contentType: file?.type,
  });
  let reformattedText = transcriptionText;

  try {
    reformattedText = await requestLyricLineBreaks(transcriptionText);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
  }

  return normalizeStructuredTranscript(reformattedText);
}

export async function transcribeStoredAudio({
  audioKey,
  fileName,
  signal,
  onProgress,
  onDelta,
}) {
  onProgress?.({
    stage: "fetching-audio",
    message: "Loading the uploaded audio from storage...",
  });

  const { buffer, contentType } = await getAudioObject(audioKey, signal);

  onProgress?.({
    stage: "transcribing",
    message: "Streaming the transcript from OpenAI...",
  });

  const transcriptionText = await requestTranscriptionStream({
    fileBuffer: buffer,
    fileName,
    contentType,
    signal,
    onDelta,
  });

  onProgress?.({
    stage: "formatting-lines",
    message: "Formatting lyric-style line breaks...",
  });

  let reformattedText = transcriptionText;

  try {
    reformattedText = await requestLyricLineBreaks(transcriptionText, signal);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
  }

  return normalizeStructuredTranscript(reformattedText);
}
