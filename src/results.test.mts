import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { prepareResultsForUpload } from "./results.mts";

const sarifFixture = fs.readFileSync(
  new URL("./testdata/scorecard-multi-run.sarif", import.meta.url),
  "utf8",
);

test("prepares valid SARIF", () => {
  const prepared = JSON.parse(prepareResultsForUpload(sarifFixture, "sarif"));
  assert.equal(prepared.runs.length, 3);
  assert.deepEqual(
    prepared.runs.map(
      (run: { properties: { category: string } }) => run.properties.category,
    ),
    ["scorecard-branch-protection", "scorecard-local", "scorecard-online-scm"],
  );
});

test("rejects invalid SARIF", () => {
  assert.throws(
    () => prepareResultsForUpload('{"version":"2.0.0"}', "sarif"),
    new Error('Invalid SARIF: version must be "2.1.0"'),
  );
});

test("accepts valid JSON unchanged", () => {
  for (const content of ['{"score":10}', "[1,2,3]", "null", '"result"']) {
    assert.equal(prepareResultsForUpload(content, "json"), content);
  }
});

test("rejects empty or invalid JSON", () => {
  assert.throws(
    () => prepareResultsForUpload("  ", "json"),
    new Error("Invalid JSON results: file is empty"),
  );
  assert.throws(
    () => prepareResultsForUpload("{", "json"),
    /^Error: Invalid JSON results:/,
  );
});

test("rejects unsupported formats", () => {
  assert.throws(
    () => prepareResultsForUpload("{}", "xml"),
    new Error("Unsupported results format: xml"),
  );
});
