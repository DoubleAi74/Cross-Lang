import { extractHindiTokens, normalizeHindiToken } from "@/lib/hindi/tokens";

const DEVANAGARI_INDEPENDENT_VOWELS = {
  अ: "a",
  आ: "aa",
  इ: "i",
  ई: "ii",
  उ: "u",
  ऊ: "uu",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
  ऋ: "ri",
};
const DEVANAGARI_MATRAS = {
  "ा": "aa",
  "ि": "i",
  "ी": "ii",
  "ु": "u",
  "ू": "uu",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ृ": "ri",
};
const DEVANAGARI_CONSONANTS = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
  ळ: "l",
};
const DEVANAGARI_MARKS = {
  "ं": "n",
  "ँ": "n",
  "ः": "h",
};
const DEVANAGARI_VIRAMA = "्";
const DEVANAGARI_NUKTA = "़";

export function transliterateHindiToken(value) {
  const token = normalizeHindiToken(value);

  if (!token) {
    return "";
  }

  const chars = Array.from(token);
  let output = "";

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (char === "-") {
      output += "-";
      continue;
    }

    if (DEVANAGARI_INDEPENDENT_VOWELS[char]) {
      output += DEVANAGARI_INDEPENDENT_VOWELS[char];
      continue;
    }

    if (DEVANAGARI_MARKS[char]) {
      output += DEVANAGARI_MARKS[char];
      continue;
    }

    if (char === DEVANAGARI_NUKTA) {
      continue;
    }

    const consonant = DEVANAGARI_CONSONANTS[char];

    if (!consonant) {
      continue;
    }

    const next = chars[index + 1];

    if (next === DEVANAGARI_VIRAMA) {
      output += consonant;
      index += 1;
      continue;
    }

    if (next && DEVANAGARI_MATRAS[next]) {
      output += consonant + DEVANAGARI_MATRAS[next];
      index += 1;
      continue;
    }

    output += `${consonant}a`;
  }

  return output || token;
}

export function transliterateHindi(value) {
  return extractHindiTokens(value).map(transliterateHindiToken).join(" ");
}
