import { useState, useCallback } from "react";
import { imageEdit } from "../lib/grokApi";
import { getDownloadFilename } from "../lib/downloadUtils";
import { formatBytes, prepareImageForUpload } from "../lib/imagePreparation";
import ImageUpload from "../components/ImageUpload";

export default function ImageToImage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileSelect = useCallback(async (file: File) => {
    setPreparingImage(true);
    setError(null);
    setResultUrl(null);
    setUploadHint(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setPreview(prepared.dataUrl);
      setUploadHint(prepared.optimized
        ? `Optimized locally: ${formatBytes(prepared.originalBytes)} → ${formatBytes(prepared.outputBytes)} (${prepared.width}×${prepared.height}).`
        : `Ready: ${formatBytes(prepared.outputBytes)} (${prepared.width}×${prepared.height}).`);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "The image could not be prepared.");
    } finally {
      setPreparingImage(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!preview || !prompt.trim()) {
      setError("Please upload an image and enter a prompt.");
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrl(null);
    try {
      const url = await imageEdit(prompt.trim(), preview);
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [preview, prompt]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Image to Image</h1>
        <p className="subtitle">Upload an image and describe how to edit it. The model returns a new image.</p>
      </div>

      {resultUrl && (
        <div className="result result-on-top">
          <div className="result-compare">
            <div className="result-compare-item">
              <span className="result-compare-label">Original</span>
              <img src={preview!} alt="Original" className="result-img" />
            </div>
            <div className="result-compare-item">
              <span className="result-compare-label">Generated</span>
              <img src={resultUrl} alt="Generated" className="result-img" />
            </div>
          </div>
          <a href={resultUrl} download={getDownloadFilename(resultUrl)} className="download-link">
            ↓ Download image
          </a>
        </div>
      )}

      <div className="form-card">
        <div className="form">
          <label className="block">
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Change the sky to sunset and add birds"
              maxLength={5000}
              rows={3}
            />
          </label>
          <ImageUpload
            preview={preview}
            onFileSelect={onFileSelect}
            busy={preparingImage}
            hint={uploadHint}
          />
          <button
            type="button"
            className="primary-button"
            onClick={submit}
            disabled={loading || preparingImage || !preview || !prompt.trim()}
          >
            {loading ? <><span className="spinner" /> Generating…</> : "Generate image"}
          </button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
