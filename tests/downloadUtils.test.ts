import assert from "node:assert/strict";
import test from "node:test";
import { getDownloadFilename } from "../src/lib/downloadUtils.ts";

test("download filename follows the real media URL behind the private proxy", () => {
  const target = "https://imgen.x.ai/xai-imgen/generated.jpeg?token=secret";
  const proxy = `https://private.example/api/proxy?url=${encodeURIComponent(target)}`;
  assert.equal(getDownloadFilename(proxy), "grok-image.jpeg");
});

test("download filename uses the requested fallback extension", () => {
  assert.equal(getDownloadFilename("blob:https://private.example/id", "grok-video", "mp4"), "grok-video.mp4");
});
