/**
 * Client-side image helper — reads a File and returns a downscaled JPEG data URL.
 * Same approach the Progress module uses so physique photos stay small, private
 * and cheap to store (no external bucket, no public URL).
 *
 * Camera photos on phones are often 12–48 MP. Decoding one of those at full
 * resolution inside the page is enough to hit the mobile renderer's memory
 * limit and crash the tab right after a scan. So we resize during decode with
 * `createImageBitmap` when the browser supports it, and cap the final base64
 * string so a single check-in can never exceed Convex's value size limit.
 */

/** Hard cap: Convex rejects strings ≥ 1 MB and the server accepts ≤ 900k chars. */
const MAX_DATA_URL_CHARS = 850_000;

function measure(dataUrl: string) {
  return dataUrl.length;
}

async function encodeBitmap(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number,
): Promise<string> {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process the photo — try uploading from the gallery.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", quality);
  // Release the backing store immediately on mobile.
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

/**
 * Progressive fallback: try the requested size first, then step down until the
 * encoded string fits the cap. Never returns anything the server will reject.
 */
async function encodeWithCap(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number,
): Promise<string> {
  let width = maxWidth;
  let q = quality;
  let out = await encodeBitmap(bitmap, width, q);
  for (let i = 0; i < 6 && measure(out) > MAX_DATA_URL_CHARS; i += 1) {
    width = Math.round(width * 0.8);
    q = Math.max(0.45, q - 0.08);
    out = await encodeBitmap(bitmap, width, q);
  }
  return out;
}

async function decodeViaImageElement(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await img.decode().catch(
    () =>
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }),
  );
  return img;
}

export async function fileToDownscaledDataUrl(
  file: File,
  maxWidth = 720,
  quality = 0.78,
): Promise<string> {
  // `createImageBitmap` with resize decodes straight to the target size, so a
  // 48 MP camera shot never exists as a full-resolution bitmap in memory.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: Math.min(maxWidth, 1600),
        resizeQuality: "high",
        imageOrientation: "from-image",
      });
      try {
        return await encodeWithCap(bitmap, maxWidth, quality);
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the classic reader path below.
    }
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });

  // If even the raw file is already small, it is safe to skip canvas work.
  let img: HTMLImageElement;
  try {
    img = await decodeViaImageElement(dataUrl);
  } catch {
    if (measure(dataUrl) <= MAX_DATA_URL_CHARS) return dataUrl;
    throw new Error("That photo is too large to process — try a lower-resolution shot.");
  }
  if (!img.width || !img.height) {
    if (measure(dataUrl) <= MAX_DATA_URL_CHARS) return dataUrl;
    throw new Error("That photo could not be processed — try a different one.");
  }

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    img.src = "";
    if (measure(dataUrl) <= MAX_DATA_URL_CHARS) return dataUrl;
    throw new Error("This browser cannot process the photo — try uploading from the gallery.");
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.src = ""; // release the decoded full-resolution image before encoding

  let out = canvas.toDataURL("image/jpeg", quality);
  for (let i = 0; i < 6 && measure(out) > MAX_DATA_URL_CHARS; i += 1) {
    canvas.width = Math.max(1, Math.round(canvas.width * 0.8));
    canvas.height = Math.max(1, Math.round(canvas.height * 0.8));
    out = canvas.toDataURL("image/jpeg", Math.max(0.45, quality - 0.08 * (i + 1)));
  }
  canvas.width = 0;
  canvas.height = 0;

  if (measure(out) > MAX_DATA_URL_CHARS) {
    throw new Error("That photo is too large to save — try a lower-resolution shot.");
  }
  return out;
}
