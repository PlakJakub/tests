import { normalizeQuestionText } from "./normalizeQuestions";
import type { ExtractedQuestion, ExtractedQuestions } from "./types";

function getSimilarityScore(left: string, right: string): number {
  const leftTokens = left.split(/\s+/).filter(Boolean);
  const rightTokens = right.split(/\s+/).filter(Boolean);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  if (union === 0) {
    return 0;
  }

  const overlap = intersection / union;
  if (left === right) {
    return 1;
  }

  return overlap;
}

export function isLikelyDuplicateQuestion(
  existing: ExtractedQuestion,
  incoming: ExtractedQuestion,
): boolean {
  const existingText = normalizeQuestionText(existing.question);
  const incomingText = normalizeQuestionText(incoming.question);

  if (!existingText || !incomingText) {
    return false;
  }

  if (existingText === incomingText) {
    return true;
  }

  if (existing.id === incoming.id) {
    return getSimilarityScore(existingText, incomingText) >= 0.8;
  }

  return getSimilarityScore(existingText, incomingText) >= 0.92;
}

function mergeDuplicate(
  existing: ExtractedQuestion,
  incoming: ExtractedQuestion,
): ExtractedQuestion {
  return {
    id: existing.id,
    question:
      incoming.question.trim().length > existing.question.trim().length
        ? incoming.question
        : existing.question,
    a: existing.a || incoming.a,
    b: existing.b || incoming.b,
    c: existing.c || incoming.c,
    d: existing.d || incoming.d,
  };
}

export function mergeQuestions(
  existingQuestions: ExtractedQuestions,
  incomingQuestions: ExtractedQuestions,
): ExtractedQuestions {
  const merged = existingQuestions.map((question) => ({ ...question }));

  for (const incoming of incomingQuestions) {
    const matchIndex = merged.findIndex((existing) =>
      isLikelyDuplicateQuestion(existing, incoming),
    );

    if (matchIndex === -1) {
      merged.push({ ...incoming });
      continue;
    }

    merged[matchIndex] = mergeDuplicate(merged[matchIndex], incoming);
  }

  return merged;
}
