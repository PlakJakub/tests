export const API_URL = "https://example.com/api/upload";

export async function uploadPhoto(photo: Blob): Promise<Response> {
  const formData = new FormData();
  formData.append("file", photo, "photo.jpg");

  const response = await fetch(API_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Wysyłanie zdjęcia nie powiodło się (HTTP ${response.status}).`);
  }

  return response;
}
