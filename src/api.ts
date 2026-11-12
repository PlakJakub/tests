import OpenAI from "openai";
import type { ExtractedQuestion, ExtractedQuestions } from "../shared/types";
import { normalizeQuestions } from "../shared/normalizeQuestions";

export { normalizeQuestionText } from "../shared/normalizeQuestions";
export type { ExtractedQuestion, ExtractedQuestions } from "../shared/types";

const API_KEY_STORAGE = "testyv2-openai-api-key";
const MODEL_STORAGE = "testyv2-openai-model";
export const OPENAI_MODEL_OPTIONS = [
  { value: "gpt-6-luna", label: "GPT-6 Luna" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
] as const;
export type OpenAIModel = (typeof OPENAI_MODEL_OPTIONS)[number]["value"];

function isOpenAIModel(value: string | null): value is OpenAIModel {
  return OPENAI_MODEL_OPTIONS.some((option) => option.value === value);
}

function readStoredModel(): OpenAIModel {
  try {
    const storedModel = localStorage.getItem(MODEL_STORAGE);
    return isOpenAIModel(storedModel) ? storedModel : "gpt-6-luna";
  } catch {
    return "gpt-6-luna";
  }
}

let selectedModel: OpenAIModel = readStoredModel();
let apiKeyLoaded = false;
let cachedApiKey: string | undefined;
let client: OpenAI | undefined;

export function getSelectedModel(): OpenAIModel {
  return selectedModel;
}

export function saveSelectedModel(value: string): boolean {
  if (!isOpenAIModel(value)) {
    return false;
  }

  selectedModel = value;
  try {
    localStorage.setItem(MODEL_STORAGE, value);
    return true;
  } catch (error) {
    console.error("Nie udało się zapisać wybranego modelu.", error);
    return false;
  }
}

export function initializeApiKey(): boolean {
  if (apiKeyLoaded) {
    return Boolean(cachedApiKey);
  }

  apiKeyLoaded = true;
  try {
    cachedApiKey = localStorage.getItem(API_KEY_STORAGE)?.trim() || undefined;
  } catch {
    cachedApiKey = undefined;
  }

  return Boolean(cachedApiKey);
}

export function saveApiKey(value: string): void {
  cachedApiKey = value.trim() || undefined;
  client = undefined;

  if (!cachedApiKey) {
    return;
  }

  try {
    localStorage.setItem(API_KEY_STORAGE, cachedApiKey);
  } catch {
    return;
  }
}

function getApiKey(): string | undefined {
  if (!apiKeyLoaded) {
    return undefined;
  }
  return cachedApiKey;
}

function getClient(): OpenAI | undefined {
  if (client) {
    return client;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return undefined;
  }

  try {
    client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    return client;
  } catch {
    return undefined;
  }
}

const extractionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          question: { type: "string" },
          a: { type: "string" },
          b: { type: "string" },
          c: { type: "string" },
          d: { type: "string" },
        },
        required: ["id", "question", "a", "b", "c", "d"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const extractionInstructions = [
  "Odczytaj ze zdjęcia wszystkie widoczne pytania testowe i przypisane im odpowiedzi A, B, C oraz D.",
  "Wykonuj wyłącznie wierną transkrypcję. Nie rozwiązuj pytań, nie wybieraj poprawnej odpowiedzi, nie poprawiaj tekstu i niczego nie dopisuj.",
  "Zachowaj oryginalną kolejność pytań oraz pełną treść. Połącz łamania wierszy wewnątrz pytania lub odpowiedzi pojedynczą spacją.",
  "Rozpoznawaj oznaczenia odpowiedzi takie jak A), A., A: lub A-. W polach a, b, c i d zwróć samą treść odpowiedzi bez jej oznaczenia A/B/C/D. Brakującą albo nieobecną odpowiedź zwróć jako pusty string.",
  "W polu id przepisz numer pytania dokładnie tak, jak jest wydrukowany. Nie numeruj pytań ponownie według kolejności zdjęcia. Traktuj 12 jako numer 12, nigdy jako 1.2 ani jako pytanie numer 1.",
  "Jeśli pytanie nie ma widocznego numeru, nadaj mu kolejny numer w kolejności czytania, nie zmieniając numerów pytań, które są wydrukowane.",
  "Nie zgaduj nieczytelnych fragmentów. Zapisz tylko dający się odczytać tekst.",
  "Zwróć każde pytanie, które da się odczytać, bez łączenia sąsiednich pytań.",
].join(" ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuestion(value: unknown): value is ExtractedQuestion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.id) &&
    typeof value.question === "string" &&
    typeof value.a === "string" &&
    typeof value.b === "string" &&
    typeof value.c === "string" &&
    typeof value.d === "string"
  );
}

async function toImageDataUrl(image: Blob): Promise<string | undefined> {
  try {
    const mimeType = image.type.toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) || image.size === 0) {
      return undefined;
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }

    return `data:${mimeType};base64,${btoa(binary)}`;
  } catch {
    return undefined;
  }
}

export async function extractQuestionsFromPhoto(
  photo: Blob,
): Promise<ExtractedQuestions> {
  try {
    const client = getClient();
    if (!client) {
      return [];
    }

    const imageDataUrl = await toImageDataUrl(photo);
    if (!imageDataUrl) {
      return [];
    }
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: extractionInstructions },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "extracted_questions",
          strict: true,
          schema: extractionSchema,
        },
      },
    });

    if (!response.output_text) {
      return [];
    }

    const parsed: unknown = JSON.parse(response.output_text);
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.questions) ||
      !parsed.questions.every(isQuestion)
    ) {
      return [];
    }

    return normalizeQuestions(parsed.questions);
  } catch {
    return [];
  }
}

export type QuestionAnswerResult = {
  answer: "A" | "B" | "C" | "D" | "";
  reason: string;
  confidence: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Nieznany błąd usługi OpenAI.";
}

const answerSchema = {
  type: "object",
  properties: {
    answer: { type: "string", enum: ["A", "B", "C", "D"] },
    reason: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["answer", "reason", "confidence"],
  additionalProperties: false,
} as const;

function isAnswer(value: string): value is "A" | "B" | "C" | "D" {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

export async function solveQuestionWithOpenAI(
  question: ExtractedQuestion,
): Promise<QuestionAnswerResult> {
  const client = getClient();
  if (!client) {
    return {
      answer: "",
      reason: "Brak klucza API OpenAI. Dodaj klucz, aby rozwiązywać pytania.",
      confidence: 0,
    };
  }

  const options = [question.a, question.b, question.c, question.d];
  const instructions = `
Jesteś ekspertem rozwiązującym pytania testowe jednokrotnego wyboru.

Twoim zadaniem jest ustalenie prawidłowej odpowiedzi A, B, C albo D.

ZASADY WERYFIKACJI:

1. Weryfikuj odpowiedź za pomocą Web Search, gdy pytanie wymaga źródeł lub aktualnych informacji.
2. Web Search wykonuj w języku polskim.
3. W przypadku aktualnego prawa pierwszeństwo ma aktualny stan prawny.
4. Porównaj każdą odpowiedź A-D z informacjami znalezionymi w źródłach.
5. Wybierz dokładnie jedną odpowiedź.
6. Nie zgaduj.
7. Jeżeli źródła nie pozwalają jednoznacznie ustalić odpowiedzi, wybierz odpowiedź najlepiej uzasadnioną dostępnymi źródłami i obniż confidence.

WAŻNE:
- Korzystaj z Web Search jako źródła weryfikacji, a nie tylko dodatkowego źródła.
- Nie pomijaj sprawdzenia źródeł tylko dlatego, że odpowiedź wydaje się oczywista.

ODPOWIEDŹ:
Zwróć wyłącznie dane zgodne ze zdefiniowanym JSON Schema.
answer musi być dokładnie jedną z wartości: A, B, C albo D.
reason powinien krótko wyjaśniać, dlaczego wybrana odpowiedź jest prawidłowa.
`;
  const input = [
    {
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: [
            "Rozwiąż poniższe pytanie wielokrotnego wyboru.",
            "",
            `Pytanie: ${question.question}`,
            `A: ${options[0]}`,
            `B: ${options[1]}`,
            `C: ${options[2]}`,
            `D: ${options[3]}`,
          ].join("\n"),
        },
      ],
    },
  ];
  const text = {
    format: {
      type: "json_schema" as const,
      name: "question_answer",
      strict: true,
      schema: answerSchema,
    },
  };
  let response: Awaited<ReturnType<typeof client.responses.create>>;
  try {
    response = await client.responses.create({
      model: getSelectedModel(),
      tools: [{ type: "web_search" }],
      instructions,
      input,
      text,
    });
  } catch (error) {
    console.error("Nie udało się rozwiązać pytania przez OpenAI.", error);
    return {
      answer: "",
      reason: `Nie udało się rozwiązać pytania: ${getErrorMessage(error)}`,
      confidence: 0,
    };
  }

  try {
    if (!response.output_text) {
      return {
        answer: "",
        reason: "Usługa nie zwróciła rozwiązania. Spróbuj ponownie.",
        confidence: 0,
      };
    }

    const parsed: unknown = JSON.parse(response.output_text);
    if (
      !isRecord(parsed) ||
      typeof parsed.answer !== "string" ||
      typeof parsed.reason !== "string" ||
      typeof parsed.confidence !== "number"
    ) {
      return {
        answer: "",
        reason: "Usługa zwróciła odpowiedź w nieprawidłowym formacie.",
        confidence: 0,
      };
    }

    const answer = parsed.answer.toUpperCase();
    if (!isAnswer(answer)) {
      return {
        answer: "",
        reason: "Usługa nie wskazała poprawnej odpowiedzi A, B, C ani D.",
        confidence: 0,
      };
    }

    return {
      answer,
      reason: parsed.reason,
      confidence: Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0,
    };
  } catch (error) {
    console.error("Nie udało się odczytać rozwiązania zwróconego przez OpenAI.", error);
    return {
      answer: "",
      reason: `Nie udało się odczytać rozwiązania: ${getErrorMessage(error)}`,
      confidence: 0,
    };
  }
}
