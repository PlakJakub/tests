import { startCamera, stopCamera, takePhoto } from "./camera";
import { startClock } from "./clock";
import { clearStoredQuestions, loadStoredQuestions, processImage, solvePendingQuestions } from "./questionStore";
import {
  getSelectedModel,
  initializeApiKey,
  OPENAI_MODEL_OPTIONS,
  saveApiKey,
  saveSelectedModel,
} from "./api";
import type { StoredQuestion } from "../shared/types";
import "./styles.css";

type AppState = "clock" | "camera" | "settings" | "results";

const LONG_PRESS_MS = 700;
const MOVE_CANCEL_DISTANCE = 10;

const clockScreen = getElement<HTMLElement>("clock-screen");
const clockElement = getElement<HTMLTimeElement>("clock");
const clockAnswerPanel = getElement<HTMLElement>("clock-answer-panel");
const clockAnswers = getElement<HTMLOListElement>("clock-answers");
const cameraScreen = getElement<HTMLElement>("camera-screen");
const settingsScreen = getElement<HTMLElement>("settings-screen");
const resultsScreen = getElement<HTMLElement>("results-screen");
const cameraPreview = getElement<HTMLVideoElement>("camera-preview");
const takePhotoButton = getElement<HTMLButtonElement>("take-photo");
const cancelCameraButton = getElement<HTMLButtonElement>("cancel-camera");
const openSettingsButton = getElement<HTMLButtonElement>("open-settings");
const modelSelect = getElement<HTMLSelectElement>("model-select");
const settingsStatus = getElement<HTMLParagraphElement>("settings-status");
const returnFromSettingsButton = getElement<HTMLButtonElement>("return-from-settings");
const previewAnswersButton = getElement<HTMLButtonElement>("preview-answers");
const clearAnswersButton = getElement<HTMLButtonElement>("clear-answers");
const apiKeyDialog = getElement<HTMLDialogElement>("api-key-dialog");
const apiKeyForm = getElement<HTMLFormElement>("api-key-form");
const apiKeyInput = getElement<HTMLInputElement>("api-key-input");
const resultsList = getElement<HTMLOListElement>("extracted-questions");
const processingStatus = getElement<HTMLParagraphElement>("processing-status");
const returnFromResultsButton = getElement<HTMLButtonElement>("return-from-results");
const addPhotoButton = getElement<HTMLButtonElement>("add-photo");

type DisplayedQuestion = {
  id: number | string;
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;
  answer?: "A" | "B" | "C" | "D";
  reason?: string;
  solved?: boolean;
};

let state: AppState = "clock";
let longPressTimer: number | undefined;
let pointerStart: { x: number; y: number } | undefined;
let capturedPhoto: Blob | null = null;
const startupClearSucceeded = clearStoredQuestions();
let extractedQuestions = toDisplayedQuestions(loadStoredQuestions());
let cameraRequestId = 0;
let pendingPhotoCount = 0;
let processingMessage = "";

displayClockAnswers();
if (!startupClearSucceeded) {
  processingMessage = "Nie udało się wyczyścić odpowiedzi z poprzedniej sesji.";
  updateProcessingStatus();
}

if (!initializeApiKey()) {
  try {
    apiKeyDialog.showModal();
  } catch {
    apiKeyDialog.setAttribute("open", "");
  }
}

for (const model of OPENAI_MODEL_OPTIONS) {
  const option = document.createElement("option");
  option.value = model.value;
  option.textContent = model.label;
  modelSelect.append(option);
}
modelSelect.value = getSelectedModel();

apiKeyForm.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  saveApiKey(apiKeyInput.value);
  apiKeyInput.value = "";
  apiKeyDialog.close();
  void solveSavedQuestions();
});

getElement<HTMLButtonElement>("skip-api-key").addEventListener("click", () => {
  apiKeyDialog.close();
});

startClock(clockElement);

export function getCapturedPhoto(): Blob | null {
  return capturedPhoto;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Nie znaleziono elementu interfejsu: ${id}`);
  }
  return element as T;
}

function setState(nextState: AppState): void {
  state = nextState;
  clockScreen.hidden = state !== "clock";
  cameraScreen.hidden = state !== "camera";
  settingsScreen.hidden = state !== "settings";
  resultsScreen.hidden = state !== "results";
}

function displayQuestions(questions: DisplayedQuestion[]): void {
  if (questions.length === 0) {
    resultsList.replaceChildren();
    return;
  }

  const rows = questions.map((question) => {
    const row = document.createElement("li");
    row.className = "extracted-question";

    const title = document.createElement("h2");
    title.textContent = `${String(question.id)} · ${question.question.trim().slice(0, 4)} — ${question.question}`;
    row.append(title);

    if (question.solved && question.answer) {
      const solution = document.createElement("p");
      solution.textContent = `Poprawna odpowiedź: ${question.answer}`;
      solution.style.fontWeight = "700";
      row.append(solution);
    }

    if (question.reason) {
      const reason = document.createElement("p");
      reason.textContent = question.reason;
      reason.style.fontSize = "0.85rem";
      row.append(reason);
    }

    const answers = document.createElement("ul");
    for (const letter of ["a", "b", "c", "d"] as const) {
      const answer = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = `${letter.toUpperCase()}. `;
      const text = document.createElement("span");
      text.textContent = question[letter] || "(brak odczytanej odpowiedzi)";
      if (question.answer && question.answer === letter.toUpperCase()) {
        text.style.fontWeight = "700";
        text.style.color = "#0b8f4a";
      }
      answer.append(label, text);
      answers.append(answer);
    }

    row.append(answers);
    return row;
  });

  resultsList.replaceChildren(...rows);
}

function displayClockAnswers(): void {
  const readyQuestions = extractedQuestions.filter(
    (question) =>
      typeof question.id === "number" &&
      question.solved &&
      question.answer,
  );
  const rows = readyQuestions.map((question) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${String(question.id)} · ${question.question.trim().slice(0, 4)}: `;
    const answer = document.createElement("strong");
    answer.textContent = question.answer ?? "";
    row.append(label, answer);
    return row;
  });

  clockAnswers.replaceChildren(...rows);
  clockAnswerPanel.hidden = rows.length === 0;
  const availableHeight = window.innerHeight - 24;
  const fontSize = rows.length > 0
    ? Math.min(9, Math.max(4, availableHeight / (rows.length * 1.1)))
    : 9;
  clockAnswerPanel.style.setProperty("--answer-font-size", `${fontSize}px`);
}

function toDisplayedQuestions(questions: StoredQuestion[]): DisplayedQuestion[] {
  return questions
    .map((question) => ({
      id: question.questionNumber ?? "?",
      question: question.question,
      a: question.a,
      b: question.b,
      c: question.c,
      d: question.d,
      answer: question.answer,
      reason: question.reason,
      solved: question.solved,
    }))
    .sort((left, right) => {
      const leftId = typeof left.id === "number" ? left.id : Number.NaN;
      const rightId = typeof right.id === "number" ? right.id : Number.NaN;
      if (Number.isNaN(leftId)) {
        return Number.isNaN(rightId) ? 0 : 1;
      }
      if (Number.isNaN(rightId)) {
        return -1;
      }
      return leftId - rightId;
    });
}

function updateProcessingStatus(): void {
  processingStatus.textContent = pendingPhotoCount > 0
    ? `Przetwarzanie zdjęć: ${pendingPhotoCount} w kolejce lub w trakcie.`
    : processingMessage;
}

function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) {
    return Promise.resolve("unsupported");
  }
  if (Notification.permission !== "default") {
    return Promise.resolve(Notification.permission);
  }

  return Notification.requestPermission().catch((error: unknown) => {
    console.error("Nie udało się uzyskać zgody na powiadomienia.", error);
    return "denied";
  });
}

function formatQuestionForNotification(question: DisplayedQuestion): string {
  const title = `${String(question.id)} · ${question.question.trim().slice(0, 4)} — ${question.question}`;
  const options = (["a", "b", "c", "d"] as const)
    .map((letter) => `${letter.toUpperCase()}. ${question[letter] || "(brak odczytanej odpowiedzi)"}`)
    .join("\n");
  const solution = question.answer ? `\nPoprawna odpowiedź: ${question.answer}` : "";
  const reason = question.reason ? `\n${question.reason}` : "";
  return `${title}\n${options}${solution}${reason}`;
}

async function sendResultsNotification(
  questions: DisplayedQuestion[],
  permissionPromise: Promise<NotificationPermission | "unsupported">,
): Promise<boolean> {
  const permission = await permissionPromise;
  if (permission !== "granted" || !("serviceWorker" in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Wyniki odczytu zdjęć", {
    body: questions.map(formatQuestionForNotification).join("\n\n"),
    tag: "testyv2-questions",
  });
  return true;
}

async function processCapturedPhoto(
  photo: Blob,
  permissionPromise: Promise<NotificationPermission | "unsupported">,
): Promise<void> {
  pendingPhotoCount += 1;
  processingMessage = "";
  updateProcessingStatus();

  try {
    const storedQuestions = await processImage(photo);
    extractedQuestions = toDisplayedQuestions(storedQuestions);
    displayClockAnswers();

    if (state === "results") {
      displayQuestions(extractedQuestions);
    }

    try {
      const sent = await sendResultsNotification(extractedQuestions, permissionPromise);
      processingMessage = sent
        ? "Zdjęcie przetworzone. Wysłano powiadomienie z pełną listą odpowiedzi."
        : "Zdjęcie przetworzone. Powiadomienie wymaga zgody przeglądarki.";
    } catch (error) {
      console.error("Nie udało się wysłać powiadomienia z wynikami.", error);
      processingMessage = "Zdjęcie przetworzone, ale nie udało się wysłać powiadomienia.";
    }
  } catch (error) {
    console.error("Nie udało się przetworzyć zdjęcia.", error);
    processingMessage = "Nie udało się przetworzyć zdjęcia. Spróbuj ponownie.";
  } finally {
    pendingPhotoCount -= 1;
    updateProcessingStatus();
  }
}

async function solveSavedQuestions(): Promise<void> {
  const hasPendingQuestions = loadStoredQuestions().some((question) =>
    !question.solved &&
    [question.a, question.b, question.c, question.d].every((answer) => answer.trim().length > 0),
  );
  if (!hasPendingQuestions) {
    return;
  }

  pendingPhotoCount += 1;
  processingMessage = "";
  updateProcessingStatus();
  try {
    const storedQuestions = await solvePendingQuestions();
    extractedQuestions = toDisplayedQuestions(storedQuestions);
    displayClockAnswers();
    if (state === "results") {
      displayQuestions(extractedQuestions);
    }
    processingMessage = "Uzupełniono rozwiązania zapisanych pytań.";
  } catch (error) {
    console.error("Nie udało się rozwiązać zapisanych pytań.", error);
    processingMessage = "Nie udało się rozwiązać zapisanych pytań.";
  } finally {
    pendingPhotoCount -= 1;
    updateProcessingStatus();
  }
}

function clearLongPress(): void {
  if (longPressTimer !== undefined) {
    window.clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }
  pointerStart = undefined;
}

async function openCamera(): Promise<void> {
  if (state !== "clock") {
    return;
  }

  const requestId = ++cameraRequestId;
  clearLongPress();
  capturedPhoto = null;
  takePhotoButton.textContent = "ZRÓB ZDJĘCIE I ODCZYTAJ";
  takePhotoButton.disabled = true;
  setState("camera");

  try {
    await startCamera(cameraPreview);
    if (requestId !== cameraRequestId) {
      return;
    }
    takePhotoButton.disabled = false;
  } catch {
    if (requestId !== cameraRequestId) {
      return;
    }
    stopCamera(cameraPreview);
    takePhotoButton.disabled = false;
    returnToClock();
  }
}

function returnToClock(): void {
  cameraRequestId += 1;
  clearLongPress();
  stopCamera(cameraPreview);
  takePhotoButton.disabled = false;
  setState("clock");
}

clockScreen.addEventListener("pointerdown", (event: PointerEvent) => {
  if (state !== "clock" || !event.isPrimary || event.button !== 0) {
    return;
  }

  event.preventDefault();
  pointerStart = { x: event.clientX, y: event.clientY };
  clockScreen.setPointerCapture(event.pointerId);
  longPressTimer = window.setTimeout(() => {
    longPressTimer = undefined;
    void openCamera();
  }, LONG_PRESS_MS);
});

window.addEventListener("resize", displayClockAnswers);

clockScreen.addEventListener("contextmenu", (event: MouseEvent) => {
  event.preventDefault();
});

clockScreen.addEventListener("pointerup", clearLongPress);
clockScreen.addEventListener("pointercancel", clearLongPress);
clockScreen.addEventListener("lostpointercapture", clearLongPress);
clockScreen.addEventListener("pointermove", (event: PointerEvent) => {
  if (!pointerStart || longPressTimer === undefined) {
    return;
  }

  const distance = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y,
  );
  if (distance > MOVE_CANCEL_DISTANCE) {
    clearLongPress();
  }
});

takePhotoButton.addEventListener("click", async () => {
  if (state !== "camera") {
    return;
  }

  takePhotoButton.disabled = true;
  try {
    if (state !== "camera") {
      return;
    }

    const permissionPromise = requestNotificationPermission();
    const photo = capturedPhoto ?? (await takePhoto(cameraPreview));
    if (state !== "camera") {
      return;
    }
    capturedPhoto = photo;
    stopCamera(cameraPreview);
    capturedPhoto = null;
    processingMessage = "";
    updateProcessingStatus();
    displayQuestions(extractedQuestions);
    setState("results");
    void processCapturedPhoto(photo, permissionPromise);
  } catch {
    if (state !== "camera") {
      return;
    }
    returnToClock();
  } finally {
    takePhotoButton.disabled = false;
  }
});

cancelCameraButton.addEventListener("click", returnToClock);
openSettingsButton.addEventListener("click", () => {
  modelSelect.value = getSelectedModel();
  settingsStatus.textContent = "";
  setState("settings");
});
modelSelect.addEventListener("change", () => {
  settingsStatus.textContent = saveSelectedModel(modelSelect.value)
    ? "Model zapisany."
    : "Nie udało się zapisać modelu. Sprawdź pamięć przeglądarki.";
});
returnFromSettingsButton.addEventListener("click", () => {
  setState("camera");
});
previewAnswersButton.addEventListener("click", () => {
  cameraRequestId += 1;
  stopCamera(cameraPreview);
  displayQuestions(extractedQuestions);
  processingMessage = extractedQuestions.length > 0
    ? "Podgląd zapisanych odpowiedzi."
    : "Brak zapisanych odpowiedzi.";
  updateProcessingStatus();
  setState("results");
});
clearAnswersButton.addEventListener("click", () => {
  if (!clearStoredQuestions()) {
    processingMessage = "Nie udało się wyczyścić zapisanych odpowiedzi.";
    updateProcessingStatus();
    return;
  }

  extractedQuestions = [];
  displayClockAnswers();
  displayQuestions(extractedQuestions);
  processingMessage = "Odpowiedzi wyczyszczone.";
  updateProcessingStatus();
  returnToClock();
});
returnFromResultsButton.addEventListener("click", returnToClock);
addPhotoButton.addEventListener("click", () => {
  setState("clock");
  void openCamera();
});

if ("serviceWorker" in navigator && !import.meta.env.DEV) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
