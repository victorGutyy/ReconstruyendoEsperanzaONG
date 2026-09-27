// Runs in the browser before uploading (docs/04 §5.3): applies the camera
// rotation, reduces the photo to CLIENT_MAX_DIMENSION and re-encodes it as
// JPEG. It saves mobile data and converts formats the server does not accept
// (e.g. HEIC in Safari). The server still validates and re-encodes everything.
import { CLIENT_MAX_DIMENSION } from "./schema";

export class UnreadablePhotoError extends Error {
  constructor() {
    super("The browser could not decode this file");
    this.name = "UnreadablePhotoError";
  }
}

/** Width and height that fit in `max` keeping the proportions, never enlarging. */
export function fitWithin(width: number, height: number, max = CLIENT_MAX_DIMENSION) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function preparePhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadablePhotoError();
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new UnreadablePhotoError();
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new UnreadablePhotoError();
  return blob;
}

/** PUT to the signed URL with progress (fetch cannot report upload progress). */
export function uploadWithProgress(
  signedUrl: string,
  body: Blob,
  apiKey: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("apikey", apiKey);
    request.setRequestHeader("content-type", body.type);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${request.status}`));
    request.onerror = () => reject(new Error("Network error"));
    request.send(body);
  });
}
