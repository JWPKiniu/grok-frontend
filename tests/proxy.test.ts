import assert from "node:assert/strict";
import test from "node:test";
import { classifyTargetUrl } from "../server/proxyPolicy.ts";

test("proxy allows only the required xAI API methods and paths", () => {
  assert.equal(
    classifyTargetUrl("https://api.x.ai/v1/images/generations", "POST")?.kind,
    "api",
  );
  assert.equal(
    classifyTargetUrl("https://api.x.ai/v1/videos/request_123", "GET")?.kind,
    "api",
  );
  assert.equal(classifyTargetUrl("https://api.x.ai/v1/models", "GET"), null);
  assert.equal(classifyTargetUrl("https://api.x.ai/v1/images/generations", "DELETE"), null);
});

test("proxy rejects lookalike hosts and credentials", () => {
  assert.equal(classifyTargetUrl("https://imgen.x.ai.attacker.example/image.jpg", "GET"), null);
  assert.equal(classifyTargetUrl("https://user:pass@imgen.x.ai/image.jpg", "GET"), null);
  assert.equal(classifyTargetUrl("http://imgen.x.ai/image.jpg", "GET"), null);
});

test("proxy allows xAI ephemeral image and video media", () => {
  assert.equal(classifyTargetUrl("https://imgen.x.ai/a.jpeg", "GET")?.kind, "media");
  assert.equal(classifyTargetUrl("https://vidgen.x.ai/a.mp4", "HEAD")?.kind, "media");
});
