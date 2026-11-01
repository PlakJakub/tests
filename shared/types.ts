export type ExtractedQuestion = {
  id: number;
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;
};

export type ExtractedQuestions = ExtractedQuestion[];

export type StoredQuestion = {
  id: string;
  questionNumber?: number;
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;

  normalizedQuestion: string;

  answer?: "A" | "B" | "C" | "D";
  reason?: string;

  solved: boolean;

  createdAt: string;
  updatedAt: string;
};

export type StoredQuestions = StoredQuestion[];
