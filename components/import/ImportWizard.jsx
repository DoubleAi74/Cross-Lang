"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AudioDropZone from "@/components/import/AudioDropZone";
import ImportProgress from "@/components/import/ImportProgress";
import SentencePreview from "@/components/import/SentencePreview";
import AudioPlayer from "@/components/lists/AudioPlayer";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SecondaryButton from "@/components/ui/SecondaryButton";
import { extractWordEntries } from "@/lib/import/word-extraction";
import { dispatchListCreated } from "@/lib/lists/browser-events";
import { consumeSseStream } from "@/lib/sse";
import { pluralize } from "@/lib/utils";

function buildDefaultName(result) {
  return (
    result?.storyMetadata?.title?.english?.trim() ||
    "Hindi words from audio"
  );
}

function buildStepClasses(active) {
  return active
    ? "bg-ink text-white"
    : "border border-ink/10 bg-white/70 text-ink/48";
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

async function readErrorMessage(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);
  return payload?.error || fallbackMessage;
}

export default function ImportWizard({ atLimit = false }) {
  const router = useRouter();
  const uploadControllerRef = useRef(null);
  const transcriptionControllerRef = useRef(null);
  const generationControllerRef = useRef(null);
  const runIdRef = useRef(0);
  const audioUrlRef = useRef("");
  const uploadedAudioKeyRef = useRef("");
  const hasSavedListRef = useRef(false);

  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [transcript, setTranscript] = useState(null);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [partialSentences, setPartialSentences] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const reviewSentences = result?.sentences || partialSentences;
  const sentenceCount = reviewSentences.length;
  const wordCount = useMemo(
    () => extractWordEntries(reviewSentences).length,
    [reviewSentences],
  );

  useEffect(() => {
    function handlePageHide() {
      const audioKey = uploadedAudioKeyRef.current;

      if (
        !audioKey ||
        hasSavedListRef.current ||
        typeof navigator === "undefined" ||
        typeof navigator.sendBeacon !== "function"
      ) {
        return;
      }

      const payload = new Blob([JSON.stringify({ audioKey })], {
        type: "application/json",
      });

      navigator.sendBeacon("/api/import/cleanup", payload);
      uploadedAudioKeyRef.current = "";
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      uploadControllerRef.current?.abort();
      transcriptionControllerRef.current?.abort();
      generationControllerRef.current?.abort();
      window.removeEventListener("pagehide", handlePageHide);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function setUploadedAudioState(audioKey, fileName) {
    const nextAudioKey = String(audioKey || "");
    uploadedAudioKeyRef.current = nextAudioKey;
    setUploadedFileName(String(fileName || "").trim());
  }

  function clearUploadedAudioState() {
    uploadedAudioKeyRef.current = "";
    setUploadedFileName("");
  }

  async function cleanupAudioKey(audioKey, { useBeacon = false } = {}) {
    if (!audioKey) {
      return;
    }

    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const payload = new Blob([JSON.stringify({ audioKey })], {
        type: "application/json",
      });

      navigator.sendBeacon("/api/import/cleanup", payload);
      return;
    }

    try {
      await fetch("/api/import/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioKey }),
        keepalive: true,
      });
    } catch {
      // Cleanup is best-effort for abandoned uploads.
    }
  }

  function abortActiveRequests() {
    uploadControllerRef.current?.abort();
    transcriptionControllerRef.current?.abort();
    generationControllerRef.current?.abort();
    uploadControllerRef.current = null;
    transcriptionControllerRef.current = null;
    generationControllerRef.current = null;
  }

  function resetProcessingState() {
    setTranscriptPreview("");
    setTranscript(null);
    setStage("idle");
    setProgress(null);
    setPartialSentences([]);
    setResult(null);
    setError(null);
    setName("");
    setSaving(false);
    setSaveError(null);
  }

  function handleFileChange(nextFile) {
    const previousAudioKey = uploadedAudioKeyRef.current;

    abortActiveRequests();
    runIdRef.current += 1;
    setStep("upload");
    resetProcessingState();
    hasSavedListRef.current = false;

    if (previousAudioKey) {
      clearUploadedAudioState();
      void cleanupAudioKey(previousAudioKey);
    }

    setFile(nextFile);

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    const nextAudioUrl = nextFile ? URL.createObjectURL(nextFile) : "";
    audioUrlRef.current = nextAudioUrl;
    setAudioUrl(nextAudioUrl);
  }

  async function handleDiscardImport() {
    const previousAudioKey = uploadedAudioKeyRef.current;

    abortActiveRequests();
    runIdRef.current += 1;
    setStep("upload");
    resetProcessingState();
    hasSavedListRef.current = false;
    clearUploadedAudioState();
    setFile(null);

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    setAudioUrl("");

    if (previousAudioKey) {
      await cleanupAudioKey(previousAudioKey);
    }
  }

  async function handleBackToDashboard() {
    const previousAudioKey = uploadedAudioKeyRef.current;

    abortActiveRequests();
    runIdRef.current += 1;
    clearUploadedAudioState();

    if (previousAudioKey && !hasSavedListRef.current) {
      await cleanupAudioKey(previousAudioKey);
    }

    router.push("/dashboard");
  }

  async function handleStart() {
    if (!file && !uploadedAudioKeyRef.current) {
      return;
    }

    abortActiveRequests();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setStep("processing");
    setTranscriptPreview("");
    setTranscript(null);
    setStage("uploading");
    setProgress({
      stage: "uploading",
      message: uploadedAudioKeyRef.current
        ? "Reusing the uploaded audio..."
        : "Uploading audio to storage...",
      completed: 0,
      total: 0,
    });
    setPartialSentences([]);
    setResult(null);
    setError(null);
    setSaveError(null);
    setName("");

    try {
      let audioKey = uploadedAudioKeyRef.current;
      const fileName = uploadedFileName || file?.name || "audio.mp3";

      if (!audioKey) {
        const uploadUrlResponse = await fetch("/api/import/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName,
            fileSize: file?.size,
            contentType: file?.type,
          }),
        });

        if (!uploadUrlResponse.ok) {
          throw new Error(
            await readErrorMessage(
              uploadUrlResponse,
              "Failed to prepare audio upload.",
            ),
          );
        }

        const uploadUrlPayload = await uploadUrlResponse.json();

        if (runIdRef.current !== runId) {
          return;
        }

        const uploadController = new AbortController();
        uploadControllerRef.current = uploadController;

        const uploadResponse = await fetch(uploadUrlPayload.uploadUrl, {
          method: "PUT",
          headers: uploadUrlPayload.headers || {},
          body: file,
          signal: uploadController.signal,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload audio to storage.");
        }

        audioKey = uploadUrlPayload.audioKey;
        setUploadedAudioState(audioKey, fileName);
      }

      if (runIdRef.current !== runId) {
        return;
      }

      setStage("transcribing");
      setProgress({
        stage: "transcribing",
        message: "Transcribing audio...",
        completed: 0,
        total: 0,
      });

      const transcribeController = new AbortController();
      transcriptionControllerRef.current = transcribeController;

      const streamedTranscribeResponse = await fetch("/api/import/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioKey,
          fileName,
        }),
        signal: transcribeController.signal,
      });

      if (!streamedTranscribeResponse.ok) {
        throw new Error(
          await readErrorMessage(
            streamedTranscribeResponse,
            "Failed to transcribe the audio file.",
          ),
        );
      }

      if (!streamedTranscribeResponse.body) {
        throw new Error("The transcription stream did not return any data.");
      }

      let nextTranscript = null;

      await consumeSseStream(
        streamedTranscribeResponse.body,
        async ({ event, data }) => {
          if (runIdRef.current !== runId) {
            return;
          }

          if (event === "progress") {
            setStage(data?.stage || "transcribing");
            setProgress({
              stage: data?.stage || "transcribing",
              message: data?.message || "Transcribing audio...",
              completed: data?.completed ?? 0,
              total: data?.total ?? 0,
            });
            return;
          }

          if (event === "delta") {
            setTranscriptPreview(data?.text || "");
            return;
          }

          if (event === "complete") {
            nextTranscript = {
              text: data?.transcript || "",
              lines: Array.isArray(data?.lines) ? data.lines : [],
            };
            setTranscript(nextTranscript);
            setTranscriptPreview(nextTranscript.text);
            return;
          }

          if (event === "error") {
            throw new Error(data?.message || "Transcription failed.");
          }
        },
      );

      if (!nextTranscript) {
        throw new Error("The transcription stream ended without a final result.");
      }

      setStage("generating");
      setProgress({
        stage: "generating",
        message: "Generating translations...",
        completed: 0,
        total: 0,
      });

      const generationController = new AbortController();
      generationControllerRef.current = generationController;

      const generationResponse = await fetch("/api/import/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: nextTranscript.text,
          lines: nextTranscript.lines,
        }),
        signal: generationController.signal,
      });

      if (!generationResponse.ok) {
        throw new Error(
          await readErrorMessage(
            generationResponse,
            "Failed to start translation generation.",
          ),
        );
      }

      if (!generationResponse.body) {
        throw new Error("The translation stream did not return any data.");
      }

      await consumeSseStream(generationResponse.body, async ({ event, data }) => {
        if (runIdRef.current !== runId) {
          return;
        }

        if (event === "progress") {
          setStage("generating");
          setProgress(data);
          return;
        }

        if (event === "chunk-complete") {
          setPartialSentences(
            Array.isArray(data?.sentences)
              ? data.sentences
              : Array.isArray(data?.mergedSentences)
                ? data.mergedSentences
                : [],
          );
          return;
        }

        if (event === "complete") {
          const nextResult = {
            sentences: Array.isArray(data?.sentences) ? data.sentences : [],
            storyMetadata: data?.storyMetadata || null,
          };

          setResult(nextResult);
          setPartialSentences(nextResult.sentences);
          setName(buildDefaultName(nextResult));
          setStage("complete");
          setProgress({
            stage: "complete",
            message: "Translations ready to review.",
            completed: nextResult.sentences.length,
            total: nextResult.sentences.length,
          });
          setStep("review");
          return;
        }

        if (event === "error") {
          throw new Error(data?.message || "Translation generation failed.");
        }
      });
    } catch (processingError) {
      if (isAbortError(processingError) || runIdRef.current !== runId) {
        return;
      }

      setStage("error");
      setError(
        processingError?.message || "We could not finish processing this audio file.",
      );
    } finally {
      if (runIdRef.current === runId) {
        uploadControllerRef.current = null;
        transcriptionControllerRef.current = null;
        generationControllerRef.current = null;
      }
    }
  }

  async function handleSave() {
    if (!uploadedAudioKeyRef.current || !result?.sentences?.length || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/import/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioKey: uploadedAudioKeyRef.current,
          audioFileName: uploadedFileName || file?.name || null,
          name: name.trim() || buildDefaultName(result),
          sentences: result.sentences,
          storyMetadata: result.storyMetadata || null,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save imported list.");
      }

      hasSavedListRef.current = true;
      dispatchListCreated(payload);
      router.push("/dashboard");
    } catch (saveRequestError) {
      setSaveError(saveRequestError.message);
      setSaving(false);
      return;
    }
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] px-6 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="page-enter space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-forest/75">
              Audio Import
            </p>
            <h1 className="max-w-4xl text-5xl leading-tight sm:text-6xl">
              Turn a Hindi song into a live word list.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-ink/66">
              Upload an audio file, watch the translation build chunk by chunk,
              then save the extracted vocabulary into the same dashboard flow you
              already use for corpus-based lists.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className={`soft-pill ${buildStepClasses(step === "upload")}`}>
              1 Upload
            </span>
            <span
              className={`soft-pill ${buildStepClasses(
                step === "processing",
              )}`}
            >
              2 Process
            </span>
            <span className={`soft-pill ${buildStepClasses(step === "review")}`}>
              3 Review
            </span>
          </div>
        </section>

        {atLimit ? (
          <section className="glass-panel page-enter border border-white/50 p-8 text-center shadow-float">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-forest/75">
              Limit reached
            </p>
            <h2 className="mt-3 text-4xl leading-tight text-ink">
              You&apos;ve reached the maximum of 12 lists.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink/65">
              Delete or reset an existing list before importing another song.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-ink/10 bg-white/70 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white"
              >
                Back to dashboard
              </Link>
            </div>
          </section>
        ) : null}

        {!atLimit && step === "upload" ? (
          <section className="space-y-6">
            <AudioDropZone
              file={file}
              audioUrl={audioUrl}
              onFileChange={handleFileChange}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-ink/10 bg-white/70 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white"
                onClick={() => {
                  void handleBackToDashboard();
                }}
              >
                Back to dashboard
              </button>

              <PrimaryButton disabled={!file} onClick={handleStart}>
                Start Import
              </PrimaryButton>
            </div>
          </section>
        ) : null}

        {!atLimit && step === "processing" ? (
          <section className="space-y-6">
            <ImportProgress stage={stage} progress={progress} />

            {transcript ? (
              <section className="glass-panel border border-white/50 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                      Transcript ready
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink/62">
                      {transcript.lines.length} {pluralize(transcript.lines.length, "line")}{" "}
                      prepared for translation.
                    </p>
                  </div>
                  <span className="soft-pill bg-white/75 text-sm font-semibold text-ink/65">
                    {partialSentences.length}{" "}
                    {pluralize(partialSentences.length, "sentence")} built
                  </span>
                </div>
              </section>
            ) : null}

            {!transcript && transcriptPreview ? (
              <section className="glass-panel border border-white/50 p-5 sm:p-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                    Live transcript
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-ink/68">
                    {transcriptPreview}
                  </p>
                </div>
              </section>
            ) : null}

            {partialSentences.length ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                      Live preview
                    </p>
                    <h2 className="mt-2 text-3xl leading-tight text-ink">
                      Completed chunks are appearing as they finish.
                    </h2>
                  </div>
                  <span className="soft-pill bg-white/75 text-sm font-semibold text-forest/80">
                    {partialSentences.length}{" "}
                    {pluralize(partialSentences.length, "sentence")} visible
                  </span>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 sentence-scroll">
                  <SentencePreview sentences={partialSentences} showRomanization />
                </div>
              </section>
            ) : null}

            {error ? (
              <div className="space-y-4">
                <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
                  {error}
                </p>
                <div className="flex flex-wrap gap-3">
                  <SecondaryButton onClick={() => void handleStart()}>
                    Retry
                  </SecondaryButton>
                  <SecondaryButton onClick={() => void handleDiscardImport()}>
                    Choose another file
                  </SecondaryButton>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl border border-ink/10 bg-white/70 px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white"
                    onClick={() => {
                      void handleBackToDashboard();
                    }}
                  >
                    Back to dashboard
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!atLimit && step === "review" ? (
          <section className="space-y-6">
            <section className="glass-panel border border-white/50 p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-ink">
                      List name
                    </label>
                    <input
                      type="text"
                      value={name}
                      maxLength={120}
                      className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-base font-medium text-ink placeholder:text-ink/35 focus:border-coral/50"
                      onChange={(event) => setName(event.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm font-semibold text-ink/65">
                    <span className="soft-pill bg-white/80">
                      {wordCount} unique {pluralize(wordCount, "word")}
                    </span>
                    <span className="soft-pill bg-white/80">
                      {sentenceCount} {pluralize(sentenceCount, "sentence")}
                    </span>
                    {result?.storyMetadata?.level ? (
                      <span className="soft-pill bg-white/80">
                        {result.storyMetadata.level}
                      </span>
                    ) : null}
                  </div>

                  {saveError ? (
                    <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
                      {saveError}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <SecondaryButton
                      onClick={() => void handleDiscardImport()}
                      disabled={saving}
                    >
                      Import another file
                    </SecondaryButton>
                    <PrimaryButton onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save to Dashboard"}
                    </PrimaryButton>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                      Source audio
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink/62">
                      Preview the imported track before you save it.
                    </p>
                  </div>
                  <AudioPlayer src={audioUrl} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
                  Sentence preview
                </p>
                <h2 className="mt-2 text-3xl leading-tight text-ink">
                  Review the line-by-line translation before saving.
                </h2>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 sentence-scroll">
                <SentencePreview sentences={reviewSentences} showRomanization />
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </div>
  );
}
