function joinPromptSections(sections) {
  return sections.filter((section) => String(section || "").trim()).join("\n\n");
}

const SENTENCE_SET_SCHEMA = `{
  "sentences": [
    {
      "dv": "मैं यहाँ हूँ।",
      "en": "I am here.",
      "sim": [
        "I am there.",
        "You are here.",
        "We are here."
      ]
    }
  ]
}`;

const DISPLAY_TOKEN_GLOSS_SCHEMA = `{
  "items": [
    {
      "dv": "पियोगे",
      "en": "will drink"
    }
  ]
}`;

export function buildSentenceListPrompt({
  allowedHindiTokenSet,
  antiRepeatBlock = "",
  sentenceCount,
  sentenceLengthGuidance,
  strictBlock = "",
}) {
  return joinPromptSections([
    "You will receive an allowed Hindi token set.",
    `Task:
Create exactly ${sentenceCount} beginner Hindi sentences.`,
    `Hard rule:
- Every Hindi token used in each "dv" sentence must exactly match a token in the allowed Hindi token set
- Treat the allowed Hindi token set as the only authority
- If a token is not explicitly listed in the allowed Hindi token set, it is forbidden even if it feels common, obvious, or grammatically natural
- Do not invent, infer, or normalize any Hindi token
- Do not use any helper word, inflection, agreement form, pronoun, postposition, auxiliary, or variant unless it is explicitly present in the allowed Hindi token set
- If a natural sentence would require a forbidden token, choose a simpler sentence that stays fully within the allowed Hindi token set`,
    `Token validation:
- Validate Hindi tokens by splitting each "dv" sentence on spaces and ignoring edge punctuation such as । ? !
- A hyphenated form is allowed only if that exact full form appears in the allowed Hindi token set`,
    `Sentence quality:
- Keep sentences beginner-friendly, clear, and useful
- Prefer short day-to-day utterances such as statements, questions, requests, and simple descriptions
- Where possible, include a mix of statements, questions, requests, possession, location, and simple descriptions
- When unsure, prefer the simplest high-confidence sentence you can build from obvious allowed tokens
- Prefer safe sentence patterns such as simple copula, location, possession, and basic question sentences over ambitious sentences that may require missing words
- Do not output random word piles pretending to be sentences
- If strict token compliance and perfect naturalness conflict, keep the sentence understandable and fully token-compliant`,
    antiRepeatBlock,
    `Length guidance:
${sentenceLengthGuidance}`,
    `English:
- For each sentence, provide one correct English translation in "en"
- Provide exactly 3 plausible English-only distractors in "sim"
- Each distractor must be similar in meaning or structure, but not identical to the correct answer
- None of the distractors may equal "en"`,
    `Output:
Return exactly one valid JSON object in this shape:
${SENTENCE_SET_SCHEMA}`,
    `Requirements:
- Top-level key must be "sentences"
- Array length must be exactly ${sentenceCount}
- Each item must contain exactly the keys "dv", "en", and "sim"
- "sim" must contain exactly 3 strings
- Output valid JSON only
- Use only ASCII double quotes
- No markdown, comments, trailing commas, or extra keys`,
    `Before returning:
- Check every sentence token by token instead of relying on intuition
- Check every Hindi token in every "dv" sentence against the allowed Hindi token set
- Rewrite any sentence containing a forbidden token
- Ensure the final output is valid JSON and matches the schema exactly`,
    strictBlock,
    `Allowed Hindi token set:
${allowedHindiTokenSet}`,
  ]);
}

export function buildDisplayTokenGlossPrompt({ itemsJson }) {
  return joinPromptSections([
    "You will receive unresolved Hindi tokens and one example sentence for each token.",
    `Task:
Write a short English gloss for each Hindi token using the sentence as context.`,
    `Rules:
- Gloss the token itself, not the whole sentence
- Preserve each "dv" token exactly as provided
- Keep each gloss short and natural, usually 1 to 4 English words
- Use the sentence context to choose the right meaning
- Include tense or aspect only when it is clearly part of the token's meaning
- Return one item for each input token and do not add extra items`,
    `Output:
Return exactly one valid JSON object in this shape:
${DISPLAY_TOKEN_GLOSS_SCHEMA}`,
    `Requirements:
- Top-level key must be "items"
- Each item must contain exactly the keys "dv" and "en"
- Output valid JSON only
- Use only ASCII double quotes
- No markdown, comments, trailing commas, or extra keys`,
    `Input:
${itemsJson}`,
  ]);
}
