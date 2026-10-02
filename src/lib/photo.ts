/**
 * Client-side image helper — reads a File and returns a downscaled JPEG data URL.
 * Same approach the Progress module uses so physique photos stay small, private
 * and cheap to store (no external bucket, no public URL).
 */
export async function fileToDownscaledDataUrl(
  file: File,
  maxWidth = 720,
  quality = 0.78,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => {
    img.onload = r;
    img.onerror = r;
  });
  if (!img.width) return dataUrl;

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
