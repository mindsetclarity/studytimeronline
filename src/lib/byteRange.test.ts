import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRange } from "./byteRange.ts";

test("parses the range forms Safari sends", () => {
  assert.deepEqual(parseRange("bytes=0-1", 1000), [0, 1]);
  assert.deepEqual(parseRange("bytes=100-", 1000), [100, 999]);
  assert.deepEqual(parseRange("bytes=-200", 1000), [800, 999]);
  assert.deepEqual(parseRange("bytes=900-5000", 1000), [900, 999]);
});

test("no usable header means serve the whole file", () => {
  assert.equal(parseRange(null, 1000), null);
  assert.equal(parseRange("bytes=-", 1000), null);
  assert.equal(parseRange("bytes=0-1,5-9", 1000), null);
});

test("out-of-bounds ranges are unsatisfiable", () => {
  assert.equal(parseRange("bytes=1000-", 1000), "unsatisfiable");
  assert.equal(parseRange("bytes=50-10", 1000), "unsatisfiable");
});
