"use client";

import { useEffect, useRef, useState } from "react";

function formatPlaybackTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    function handleLoadedMetadata() {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
      setError("");
    }

    function handleTimeUpdate() {
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    }

    function handlePlay() {
      setIsPlaying(true);
    }

    function handlePause() {
      setIsPlaying(false);
    }

    function handleEnded() {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    }

    function handleError() {
      setError("Audio playback is unavailable for this file right now.");
      setIsPlaying(false);
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
    audio.load();
    const frame = window.requestAnimationFrame(() => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setError("");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [src]);

  if (!src) {
    return null;
  }

  async function handleTogglePlayback() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError("Audio playback is unavailable for this file right now.");
    }
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);

    if (!audio || !Number.isFinite(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <section className="glass-panel border border-white/50 p-4 sm:p-5">
      <audio ref={audioRef} preload="metadata" src={src} className="hidden" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white transition hover:bg-coral"
          onClick={handleTogglePlayback}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ink/45">
              Audio playback
            </p>
            <p className="text-sm font-medium text-ink/62">
              {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
            </p>
          </div>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="audio-slider h-2 w-full cursor-pointer"
            aria-label="Audio progress"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}
    </section>
  );
}
