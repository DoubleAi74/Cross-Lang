import { z } from "zod";
import { AppError } from "@/lib/errors";

export const wordEntrySchema = z
  .object({
    rk: z.number().int().positive(),
    dv: z.string().trim().min(1),
    rm: z.string().trim().min(1),
    en: z.string().trim().min(1),
  })
  .strict();

export const wordSetSchema = z
  .object({
    word_set: z.array(wordEntrySchema).min(1),
  })
  .strict();

export const llmSentenceSchema = z
  .object({
    dv: z.string().trim().min(1),
    en: z.string().trim().min(1),
    sim: z.array(z.string().trim().min(1)).min(3),
  })
  .strict();

export const sentenceSchema = z
  .object({
    nm: z.number().int().positive(),
    dv: z.string().trim().min(1),
    rm: z.string().trim().min(1),
    en: z.string().trim().min(1),
    sim: z.array(z.string().trim().min(1)).min(3),
  })
  .strict();

export const llmSentenceSetSchema = z
  .object({
    sentences: z.array(llmSentenceSchema).min(1),
  })
  .strict();

export const llmDisplayTokenGlossSchema = z
  .object({
    dv: z.string().trim().min(1),
    en: z.string().trim().min(1),
  })
  .strict();

export const llmDisplayTokenGlossSetSchema = z
  .object({
    items: z.array(llmDisplayTokenGlossSchema).min(1),
  })
  .strict();

function formatIssues(issues) {
  return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
}

function truncateSentenceSet(sentenceSet, expectedCount) {
  return {
    sentences: sentenceSet.sentences.slice(0, expectedCount).map((item) => ({
      ...item,
      sim: item.sim.slice(0, 3),
    })),
  };
}

export function validateSentenceSet(value, expectedCount = 10, options = {}) {
  const { allowPartial = false } = options;
  const parsed = llmSentenceSetSchema.safeParse(value);

  if (!parsed.success) {
    throw new AppError("The generated sentence set did not match the expected shape.", {
      code: "invalid_sentence_set",
      stage: "validation",
      details: formatIssues(parsed.error.issues),
      source: "sentences",
    });
  }

  let candidate = parsed.data;

  if (!allowPartial && candidate.sentences.length < expectedCount) {
    throw new AppError(
      `Expected ${expectedCount} sentences but received ${candidate.sentences.length}.`,
      {
        code: "wrong_sentence_count",
        stage: "validation",
        details: candidate.sentences,
      },
    );
  }

  candidate =
    candidate.sentences.length > expectedCount
      ? truncateSentenceSet(candidate, expectedCount)
      : truncateSentenceSet(candidate, candidate.sentences.length);

  return candidate;
}
