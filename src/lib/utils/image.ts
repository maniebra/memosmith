/** Big pasted screenshots are re-encoded; small, vector, and animated images pass through. */
const MAX_EDGE = 1920;
const MAX_BYTES = 512 * 1024;
const SKIPPED = ["image/svg+xml", "image/gif"];

export async function compressImage(
  file: File,
): Promise<{ name: string; blob: Blob }> {
  const original = { name: file.name, blob: file as Blob };

  if (!file.type.startsWith("image/") || SKIPPED.includes(file.type)) {
    return original;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);

  if (!bitmap) {
    return original;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size <= MAX_BYTES) {
    bitmap.close();
    return original;
  }

  const canvas = document.createElement("canvas");

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );

  if (!blob || blob.size >= file.size) {
    return original;
  }

  const stem = (file.name || "image").replace(/\.[^.]+$/, "");

  return { name: `${stem}.webp`, blob };
}
