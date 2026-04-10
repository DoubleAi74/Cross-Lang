export function extractWordEntries(sentences) {
  const seen = new Set();
  const entries = [];

  for (const sentence of sentences || []) {
    for (const token of sentence?.tokens || []) {
      const normalized = String(token?.word || "")
        .trim()
        .replace(/\s+/g, " ");

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      entries.push({
        dv: String(token.word || "").trim(),
        rm: String(token.transliteration || "").trim(),
        en: String(token.meaning || "").trim(),
      });
    }
  }

  return entries;
}
