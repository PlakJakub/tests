import { startCamera, stopCamera, takePhoto } from "./camera";
import { startClock } from "./clock";
import "./styles.css";

type AppState = "clock" | "camera";

const LONG_PRESS_MS = 700;
const MOVE_CANCEL_DISTANCE = 10;

const clockScreen = getElement<HTMLElement>("clock-screen");
const clockElement = getElement<HTMLTimeElement>("clock");
const clockBackground = getElement<HTMLImageElement>("clock-background");
const clockError = getElement<HTMLParagraphElement>("clock-error");
const cameraScreen = getElement<HTMLElement>("camera-screen");
const cameraPreview = getElement<HTMLVideoElement>("camera-preview");
const cameraError = getElement<HTMLParagraphElement>("camera-error");
const takePhotoButton = getElement<HTMLButtonElement>("take-photo");
const cancelCameraButton = getElement<HTMLButtonElement>("cancel-camera");

let state: AppState = "clock";
let longPressTimer: number | undefined;
let pointerStart: { x: number; y: number } | undefined;
let capturedPhoto: Blob | null = null;
let capturedPhotoUrl: string | null = null;
let cameraRequestId = 0;

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
}

function clearLongPress(): void {
  if (longPressTimer !== undefined) {
    window.clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }
  pointerStart = undefined;
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Kamera wymaga")) {
    return error.message;
  }

  if (error instanceof Error && error.message.startsWith("Kamera nie dostarczyła")) {
    return "Nie udało się odebrać obrazu z kamery. Zamknij inne aplikacje korzystające z kamery i spróbuj ponownie.";
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Brak dostępu do kamery. Zezwól na używanie kamery w ustawieniach przeglądarki.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "Nie znaleziono kamery w tym urządzeniu.";
      case "NotReadableError":
      case "TrackStartError":
        return "Nie można uruchomić kamery. Może być używana przez inną aplikację.";
      case "AbortError":
        return "Uruchamianie kamery zostało anulowane.";
      case "SecurityError":
        return "Dostęp do kamery jest zablokowany. Otwórz aplikację przez HTTPS.";
    }
  }

  return "Wystąpił błąd podczas uruchamiania kamery.";
}

async function openCamera(): Promise<void> {
  if (state !== "clock") {
    return;
  }

  const requestId = ++cameraRequestId;
  clearLongPress();
  clockError.hidden = true;
  cameraError.hidden = true;
  takePhotoButton.disabled = true;
  setState("camera");

  try {
    await startCamera(cameraPreview);
    if (requestId !== cameraRequestId) {
      return;
    }
    takePhotoButton.disabled = false;
  } catch (error) {
    console.error("Nie udało się uruchomić kamery:", error);
    if (requestId !== cameraRequestId) {
      return;
    }
    stopCamera(cameraPreview);
    takePhotoButton.disabled = false;
    clockError.textContent = cameraErrorMessage(error);
    clockError.hidden = false;
    setState("clock");
  }
}

function returnToClock(): void {
  cameraRequestId += 1;
  clearLongPress();
  stopCamera(cameraPreview);
  cameraError.hidden = true;
  clockError.hidden = true;
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
  cameraError.hidden = true;
  try {
    const photo = await takePhoto(cameraPreview);
    if (state !== "camera") {
      return;
    }
    capturedPhoto = photo;
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    capturedPhotoUrl = URL.createObjectURL(photo);
    clockBackground.src = capturedPhotoUrl;
    clockBackground.hidden = false;
    stopCamera(cameraPreview);
    setState("clock");
  } catch (error) {
    console.error("Nie udało się wykonać zdjęcia:", error);
    if (state !== "camera") {
      return;
    }
    cameraError.textContent = "Nie udało się wykonać zdjęcia. Spróbuj ponownie.";
    cameraError.hidden = false;
  } finally {
    takePhotoButton.disabled = false;
  }
});

cancelCameraButton.addEventListener("click", returnToClock);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.error("Nie udało się zarejestrować service workera:", error);
    });
  });
}
