import assert from "node:assert/strict";
import test from "node:test";
import { verifyPasswordDigest } from "../api/auth.ts";

const FIXTURE_HASH = "14102431862ea6b065e69f0784f69a410c4baa4a4d6c0891b333da3583dad22f";

test("owner password digest accepts only the matching password", async () => {
  assert.equal(await verifyPasswordDigest("correct-horse-battery-staple-test", FIXTURE_HASH), true);
  assert.equal(await verifyPasswordDigest("wrong-horse-battery-staple-test", FIXTURE_HASH), false);
  assert.equal(await verifyPasswordDigest("short", FIXTURE_HASH), false);
});
