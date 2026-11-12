import type { ExtractedQuestion, ExtractedQuestions } from "./types";

const answerLabels = {
  a: /^\s*(?:\*\*)?A\s*[).:\-–]\s*(?:\*\*)?/i,
  b: /^\s*(?:\*\*)?B\s*[).:\-–]\s*(?:\*\*)?/i,
  c: /^\s*(?:\*\*)?C\s*[).:\-–]\s*(?:\*\*)?/i,
  d: /^\s*(?:\*\*)?D\s*[).:\-–]\s*(?:\*\*)?/i,
} as const;

function stripLeadingNumberPrefix(text: string): string {
  return text
    .replace(/^\s*(?:#{1,6}\s*)?(?:\*\*)?(\d{1,4})\s*[.)]\s*(?:\*\*)?/i, "")
    .replace(/^\s*(?:\*\*)?[A-D]\s*[).:\-–]\s*(?:\*\*)?/i, "")
    .trim();
}

function normalizeAnswer(
  answer: string,
  label: keyof typeof answerLabels,
): string {
  let normalized = answer.trim();
  while (answerLabels[label].test(normalized)) {
    normalized = normalized.replace(answerLabels[label], "").trim();
  }
  return normalized;
}

export function normalizeQuestionText(text: string): string {
  if (!text) {
    return "";
  }

  let normalized = stripLeadingNumberPrefix(text)
    .normalize("NFKC")
    .replace(/[\u00A0\u2000-\u200F\u202F\u205F]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[\u00B7\u2022\u25CF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  normalized = normalized
    .replace(/\b[a-d]\s*[).:\-–]\s*/gi, " ")
    .replace(/\b(?:\*\*)/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function normalizeQuestion(question: ExtractedQuestion): ExtractedQuestion {
  const prefix = question.question.match(
    /^\s*(?:#{1,6}\s*)?(?:\*\*)?(\d{1,4})\s*[.)]\s*(?:\*\*)?\s*/,
  );
  const text = stripLeadingNumberPrefix(question.question);

  return {
    id: prefix ? Number(prefix[1]) : question.id,
    question: text,
    a: normalizeAnswer(question.a, "a"),
    b: normalizeAnswer(question.b, "b"),
    c: normalizeAnswer(question.c, "c"),
    d: normalizeAnswer(question.d, "d"),
  };
}

export function normalizeQuestions(
  questions: ExtractedQuestions,
): ExtractedQuestions {
  return questions.map(normalizeQuestion);
}
