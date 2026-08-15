import assert from "node:assert/strict";
import test from "node:test";
import {
  processImageGenerationResponse,
  processVideoPollResponse,
} from "../src/lib/grokApi.ts";

test("image parser accepts the current ephemeral URL response", () => {
  const target = "https://imgen.x.ai/xai-imgen/example.jpeg";
  const result = processImageGenerationResponse(JSON.stringify({
    data: [{ url: target, mime_type: "image/jpeg" }],
  }));

  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    assert.equal(result.resultUrl, `/api/proxy?url=${encodeURIComponent(target)}`);
  }
});

test("image parser detects JPEG when Base64 MIME metadata is absent", () => {
  const result = processImageGenerationResponse(JSON.stringify({
    data: [{ b64_json: "/9j/example" }],
  }));

  assert.deepEqual(result, {
    kind: "success",
    resultUrl: "data:image/jpeg;base64,/9j/example",
  });
});

test("image parser returns a concise structured API error", () => {
  const result = processImageGenerationResponse(JSON.stringify({
    error: { message: "Prompt rejected" },
  }));
  assert.deepEqual(result, { kind: "unknown_error", message: "Prompt rejected" });
});

test("video parser recognizes pending and done responses", () => {
  assert.deepEqual(processVideoPollResponse('{"status":"processing"}'), { kind: "pending" });

  const target = "https://vidgen.x.ai/video/example.mp4";
  const result = processVideoPollResponse(JSON.stringify({
    status: "done",
    video: { url: target },
  }));
  assert.deepEqual(result, {
    kind: "success",
    videoUrl: `/api/proxy?url=${encodeURIComponent(target)}`,
  });
});

test("video parser surfaces terminal failures without dumping raw JSON", () => {
  const result = processVideoPollResponse(JSON.stringify({
    status: "failed",
    error: { code: "bad_request", message: "Unsupported input" },
  }));
  assert.deepEqual(result, { kind: "known_error", message: "Unsupported input" });
});
