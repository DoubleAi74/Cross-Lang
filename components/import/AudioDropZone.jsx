"use client";

import { useRef, useState } from "react";
import SecondaryButton from "@/components/ui/SecondaryButton";
import { cx } from "@/lib/utils";

const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const AUDIO_EXTENSION_PATTERN = /\.(mp3|m4a|wav|webm|ogg|mp4|mpeg|aac|flac)$/i;

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateAudioFile(file) {
  if (!file) {
    return "Choose an audio file to continue.";
  }

  const matchesMimeType = typeof file.type === "string" && file.type.startsWith("audio/");
  const matchesExtension = AUDIO_EXTENSION_PATTERN.test(file.name || "");

  if (!matchesMimeType && !matchesExtension) {
    return "Choose a supported audio file such as MP3, M4A, WAV, OGG, or MP4.";
  }

  if (typeof file.size === "number" && file.size > MAX_AUDIO_FILE_SIZE) {
    return "Audio files must be 25MB or smaller.";
  }

  return "";
}

export default function AudioDropZone({
  file,
  audioUrl,
  disabled = false,
  onFileChange,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [isActive, setIsActive] = useState(false);

  function commitFile(nextFile) {
    const validationError = validateAudioFile(nextFile);

    if (validationError) {
      setError(validationError);
      onFileChange(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setError("");
    onFileChange(nextFile);
  }

  function handleInputChange(event) {
    if (disabled) {
      return;
    }

    const [nextFile] = event.target.files || [];
    commitFile(nextFile ?? null);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsActive(false);

    if (disabled) {
      return;
    }

    const [nextFile] = event.dataTransfer.files || [];
    commitFile(nextFile ?? null);
  }

  function handleRemove() {
    setError("");
    onFileChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div
        data-active={isActive ? "true" : "false"}
        className={cx(
          "glass-panel rounded-[2rem] border-2 border-dashed border-ink/12 p-6 transition sm:p-8",
          isActive && "border-coral/45 bg-white/85",
          file && "border-forest/20",
          disabled && "cursor-not-allowed opacity-70",
        )}
        onDragEnter={(event) => {
          event.preventDefault();

          if (!disabled) {
            setIsActive(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();

          if (!disabled) {
            setIsActive(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsActive(false);
        }}
        onDrop={handleDrop}
      >
        <div className="flex flex-col gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">
              <span className="soft-pill bg-white/75 text-ink/65">Audio upload</span>
              <span>Hindi songs</span>
            </div>
            <h2 className="text-3xl leading-tight text-ink sm:text-4xl">
              Drop an MP3 and we&apos;ll turn it into a word list.
            </h2>
            <p className="max-w-3xl text-base leading-7 text-ink/65">
              Upload a short Hindi audio file, review the generated translations,
              then save the extracted vocabulary directly to your dashboard.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/60 bg-white/65 p-5">
            <p className="text-lg font-semibold text-ink">
              {file?.name || "Drop audio here or browse from your device"}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/58">
              {file
                ? `${formatFileSize(file.size)} · ${file.type || "audio file"}`
                : "Supported formats include MP3, M4A, WAV, OGG, WebM, and MP4. The limit is 25MB."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <SecondaryButton
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                {file ? "Choose Different File" : "Browse Files"}
              </SecondaryButton>
              {file ? (
                <SecondaryButton onClick={handleRemove} disabled={disabled}>
                  Remove
                </SecondaryButton>
              ) : null}
            </div>

            {audioUrl ? (
              <div className="mt-5 rounded-[1.5rem] border border-ink/8 bg-white/70 p-4">
                <audio controls className="w-full" src={audioUrl}>
                  Your browser does not support inline audio playback.
                </audio>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
