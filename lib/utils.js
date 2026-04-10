import { normalizeHindiToken } from "@/lib/hindi/tokens";

export function coerceInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function shuffle(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

export function cx(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function formatScore(correct, total) {
  return `${correct}/${total}`;
}

export function formatAverageScore(value, total = 10) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}/${total}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function titleizePendingAction(action) {
  switch (action) {
    case "new-game":
      return "Preparing your first deck";
    case "same":
      return "Refreshing the same words";
    case "resample":
      return "Reshuffling your word list";
    case "add":
      return "Adding fresh words";
    case "remove":
      return "Tightening your word set";
    default:
      return "Preparing your next level";
  }
}

export function stringifyDetails(details) {
  if (!details) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function getKnownWordKey(value) {
  const rawValue = typeof value === "string" ? value : value?.dv;
  const normalized = normalizeHindiToken(rawValue);
  return normalized || String(rawValue || "").trim();
}
