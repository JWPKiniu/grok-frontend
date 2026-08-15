const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 2.4 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 640;

export type PreparedImage = {
  dataUrl: string;
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  optimized: boolean;
};

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(objectUrl) });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image format cannot be decoded by the browser."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The image could not be optimized.")),
      type,
      quality,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Keeps uploads below Vercel's 4.5 MB Function payload limit after Base64 expansion.
 * Large phone photos are resized and compressed locally; they are never uploaded elsewhere.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`The source image is too large. Maximum: ${formatBytes(MAX_SOURCE_BYTES)}.`);
  }

  const { image, release } = await loadImage(file);
  try {
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("The image has invalid dimensions.");

    const initialScale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

    if (initialScale === 1 && file.size <= TARGET_UPLOAD_BYTES) {
      return {
        dataUrl: await fileToDataUrl(file),
        originalBytes: file.size,
        outputBytes: file.size,
        width,
        height,
        optimized: false,
      };
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Image processing is not available in this browser.");

    const outputType = file.type === "image/png" || file.type === "image/webp"
      ? "image/webp"
      : "image/jpeg";
    let quality = 0.9;
    let output: Blob | null = null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      if (outputType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0, width, height);
      output = await canvasToBlob(canvas, outputType, quality);
      if (output.size <= TARGET_UPLOAD_BYTES) break;

      if (quality > 0.66) {
        quality -= 0.08;
      } else {
        if (Math.max(width, height) <= MIN_DIMENSION) break;
        const nextWidth = Math.max(1, Math.round(width * 0.82));
        const nextHeight = Math.max(1, Math.round(height * 0.82));
        if (nextWidth === width && nextHeight === height) break;
        width = nextWidth;
        height = nextHeight;
        quality = 0.82;
      }
    }

    if (!output || output.size > TARGET_UPLOAD_BYTES) {
      throw new Error("The image is still too large after optimization. Try a smaller source image.");
    }

    return {
      dataUrl: await fileToDataUrl(output),
      originalBytes: file.size,
      outputBytes: output.size,
      width,
      height,
      optimized: true,
    };
  } finally {
    release();
  }
}
