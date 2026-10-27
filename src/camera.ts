let activeStream: MediaStream | null = null;
let cameraRequestGeneration = 0;

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.requestVideoFrameCallback) {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Kamera nie dostarczyła obrazu na czas."));
      }, 10_000);

      video.requestVideoFrameCallback(() => {
        window.clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export async function startCamera(video: HTMLVideoElement): Promise<void> {
  if (!window.isSecureContext) {
    throw new Error("Kamera wymaga połączenia HTTPS. Wyjątkiem jest localhost.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Ta przeglądarka nie obsługuje dostępu do kamery.");
  }

  stopCamera(video);
  const requestId = ++cameraRequestGeneration;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    },
    audio: false,
  });

  if (requestId !== cameraRequestGeneration) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  activeStream = stream;
  video.srcObject = stream;

  try {
    await video.play();
    await waitForVideoFrame(video);
    if (requestId !== cameraRequestGeneration) {
      return;
    }
  } catch (error) {
    if (requestId === cameraRequestGeneration) {
      stopCamera(video);
    } else {
      stream.getTracks().forEach((track) => track.stop());
      if (activeStream === stream) {
        activeStream = null;
      }
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    }
    throw error;
  }
}

export function takePhoto(video: HTMLVideoElement): Promise<Blob> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
    return Promise.reject(new Error("Podgląd kamery nie jest jeszcze gotowy."));
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Nie udało się przygotować zdjęcia."));
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (photo) => {
          if (photo) {
            resolve(photo);
          } else {
            reject(new Error("Nie udało się utworzyć pliku JPEG."));
          }
        },
        "image/jpeg",
        0.9,
      );
    } catch (error) {
      reject(error);
    }
  });
}

export function stopCamera(video?: HTMLVideoElement): void {
  cameraRequestGeneration += 1;
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;

  if (video) {
    video.srcObject = null;
  }
}
