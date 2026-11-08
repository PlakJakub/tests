import { extractQuestionsFromPhoto, solveQuestionWithOpenAI, type ExtractedQuestion } from "./api";
import { normalizeQuestionText } from "../shared/normalizeQuestions";
import { isLikelyDuplicateQuestion } from "../shared/mergeQuestions";
import type { StoredQuestion, StoredQuestions } from "../shared/types";

const STORAGE_KEY = "testyv2-stored-questions";
let storageGeneration = 0;

function isStoredQuestion(value: unknown): value is StoredQuestion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const question = value as Record<string, unknown>;
  return (
    typeof question.id === "string" &&
    typeof question.question === "string" &&
    typeof question.a === "string" &&
    typeof question.b === "string" &&
    typeof question.c === "string" &&
    typeof question.d === "string" &&
    (question.questionNumber === undefined || typeof question.questionNumber === "number") &&
    typeof question.normalizedQuestion === "string" &&
    typeof question.solved === "boolean" &&
    typeof question.createdAt === "string" &&
    typeof question.updatedAt === "string"
  );
}

function makeQuestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `q-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadStoredQuestions(): StoredQuestions {
  try {
    if (typeof localStorage === "undefined") {
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredQuestion) : [];
  } catch {
    return [];
  }
}

export function saveStoredQuestions(questions: StoredQuestions): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    return;
  }
}

export function clearStoredQuestions(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    storageGeneration += 1;
    return true;
  } catch (error) {
    console.error("Nie udało się wyczyścić zapisanych odpowiedzi.", error);
    return false;
  }
}

function toExtractedQuestion(question: StoredQuestion): ExtractedQuestion {
  return {
    id: question.questionNumber ?? 0,
    question: question.question,
    a: question.a,
    b: question.b,
    c: question.c,
    d: question.d,
  };
}

function hasCompleteAnswers(question: { a: string; b: string; c: string; d: string }): boolean {
  return [question.a, question.b, question.c, question.d].every((answer) => answer.trim().length > 0);
}

function sortStoredQuestions(questions: StoredQuestions): StoredQuestions {
  return [...questions].sort((left, right) => {
    const leftNumber = left.questionNumber;
    const rightNumber = right.questionNumber;

    if (leftNumber === undefined) {
      return rightNumber === undefined ? 0 : 1;
    }
    if (rightNumber === undefined) {
      return -1;
    }
    return leftNumber - rightNumber;
  });
}

export function createStoredQuestion(question: ExtractedQuestion): StoredQuestion {
  const timestamp = new Date().toISOString();

  return {
    id: makeQuestionId(),
    questionNumber: question.id,
    question: question.question.trim(),
    a: question.a.trim(),
    b: question.b.trim(),
    c: question.c.trim(),
    d: question.d.trim(),
    normalizedQuestion: normalizeQuestionText(question.question),
    solved: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function mergeStoredQuestion(
  existing: StoredQuestion,
  incoming: ExtractedQuestion,
): StoredQuestion {
  const now = new Date().toISOString();
  const merged: StoredQuestion = {
    ...existing,
    questionNumber: existing.questionNumber ?? incoming.id,
    question:
      normalizeQuestionText(incoming.question).length > normalizeQuestionText(existing.question).length
        ? incoming.question
        : existing.question,
    a: existing.a || incoming.a,
    b: existing.b || incoming.b,
    c: existing.c || incoming.c,
    d: existing.d || incoming.d,
    normalizedQuestion: normalizeQuestionText(
      incoming.question.length > existing.question.length ? incoming.question : existing.question,
    ),
    updatedAt: now,
  };

  const conflicting = (["a", "b", "c", "d"] as const).filter((key) => {
    const currentValue = existing[key].trim();
    const incomingValue = incoming[key].trim();
    return currentValue.length > 0 && incomingValue.length > 0 && currentValue !== incomingValue;
  });

  if (conflicting.length > 0) {
    merged.reason = `Konflikt odpowiedzi: ${conflicting.join(", ")}. Wymaga ponownej weryfikacji.`;
    merged.solved = false;
    merged.answer = undefined;
  }

  return merged;
}

export async function solveStoredQuestion(
  question: StoredQuestion,
): Promise<StoredQuestion> {
  try {
    if (question.solved && question.answer) {
      return question;
    }

    if (!hasCompleteAnswers(question)) {
      return {
        ...question,
        reason: "Pytanie nie ma wszystkich odpowiedzi A/B/C/D. Oczekiwane uzupełnienie z kolejnych zdjęć.",
        solved: false,
        updatedAt: new Date().toISOString(),
      };
    }

    const result = await solveQuestionWithOpenAI({
      id: 0,
      question: question.question,
      a: question.a,
      b: question.b,
      c: question.c,
      d: question.d,
    });

    return {
      ...question,
      answer: result.answer || undefined,
      reason: result.reason,
      solved: result.answer !== "",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return question;
  }
}

export function findMatchingStoredQuestion(
  stored: StoredQuestions,
  incoming: ExtractedQuestion,
): StoredQuestion | undefined {
  let bestMatch: StoredQuestion | undefined;
  let bestScore = 0;

  for (const record of stored) {
    const score = isLikelyDuplicateQuestion(toExtractedQuestion(record), incoming)
      ? 1
      : getSimilarity(record.normalizedQuestion, normalizeQuestionText(incoming.question));

    if (score > bestScore) {
      bestScore = score;
      bestMatch = record;
    }
  }

  if (bestMatch && bestScore >= 0.92) {
    return bestMatch;
  }

  return undefined;
}

function getSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  if (union === 0) {
    return 0;
  }

  return overlap / union;
}

export async function processImage(image: Blob | string): Promise<StoredQuestions> {
  const generation = storageGeneration;
  const task = processingQueue.then(() => processImageNow(image, generation));
  processingQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

export async function solvePendingQuestions(): Promise<StoredQuestions> {
  const generation = storageGeneration;
  const task = processingQueue.then(() => solvePendingQuestionsNow(loadStoredQuestions(), generation));
  processingQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

let processingQueue: Promise<void> = Promise.resolve();

async function solvePendingQuestionsNow(
  questions: StoredQuestions = loadStoredQuestions(),
  generation = storageGeneration,
): Promise<StoredQuestions> {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (
      question &&
      hasCompleteAnswers(question) &&
      (!question.solved || question.answer === undefined || question.reason?.includes("Konflikt"))
    ) {
      questions[index] = await solveStoredQuestion(question);
    }
  }

  if (generation !== storageGeneration) {
    return loadStoredQuestions();
  }

  const sortedQuestions = sortStoredQuestions(questions);
  saveStoredQuestions(sortedQuestions);
  return sortedQuestions;
}

async function processImageNow(image: Blob | string, generation: number): Promise<StoredQuestions> {
  if (generation !== storageGeneration) {
    return loadStoredQuestions();
  }

  const questions = loadStoredQuestions();

  try {
    const blob = typeof image === "string"
      ? await (await fetch(image)).blob()
      : image;
    const extracted = await extractQuestionsFromPhoto(blob);

    for (const incoming of extracted) {
      try {
        const existing = findMatchingStoredQuestion(questions, incoming);

        if (!existing) {
          const record = createStoredQuestion(incoming);
          questions.push(record);
          continue;
        }

        if (existing.solved && existing.answer) {
          continue;
        }

        const index = questions.findIndex((record) => record.id === existing.id);
        if (index < 0) {
          continue;
        }

        const merged = mergeStoredQuestion(existing, incoming);
        questions[index] = merged;

      } catch {
        continue;
      }
    }

  } catch {
    if (generation !== storageGeneration) {
      return loadStoredQuestions();
    }
    const sortedQuestions = sortStoredQuestions(questions);
    saveStoredQuestions(sortedQuestions);
    return sortedQuestions;
  }

  return solvePendingQuestionsNow(questions, generation);
}
