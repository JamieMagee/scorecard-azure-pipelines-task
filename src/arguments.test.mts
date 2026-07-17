import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  getResultsFileName,
  getResultsFormat,
  getScorecardArguments,
} from "./arguments.mts";

test("builds Scorecard arguments with defaults", () => {
  const taskDirectory = "/task";
  const args = getScorecardArguments(
    {
      BUILD_REPOSITORY_URI:
        "https://contoso.visualstudio.com/project/_git/repository",
    },
    taskDirectory,
  );

  assert.deepEqual(args, [
    "--repo",
    "https://dev.azure.com/contoso/project/_git/repository",
    "--format",
    "sarif",
    "--output",
    "scorecard-results.sarif",
    "--policy",
    path.join(taskDirectory, "policy.yml"),
  ]);
});

test("builds Scorecard arguments with explicit inputs", () => {
  const args = getScorecardArguments(
    {
      BUILD_REPOSITORY_URI:
        "https://contoso@dev.azure.com/contoso/project/_git/repository",
      INPUT_RESULTSFILE: "results/custom.json",
      INPUT_RESULTSFORMAT: "json",
      INPUT_RESULTSPOLICY: "/repo/custom-policy.yml",
    },
    "/task",
  );

  assert.deepEqual(args, [
    "--repo",
    "https://dev.azure.com/contoso/project/_git/repository",
    "--format",
    "json",
    "--output",
    "results/custom.json",
    "--policy",
    "/repo/custom-policy.yml",
  ]);
});

test("selects the default results filename", () => {
  assert.equal(getResultsFileName({}), "scorecard-results.sarif");
  assert.equal(
    getResultsFileName({ INPUT_RESULTSFORMAT: "json" }),
    "scorecard-results.json",
  );
  assert.equal(
    getResultsFileName({
      INPUT_RESULTSFILE: "custom.sarif",
      INPUT_RESULTSFORMAT: "json",
    }),
    "custom.sarif",
  );
});

test("selects the results format", () => {
  assert.equal(getResultsFormat({}), "sarif");
  assert.equal(getResultsFormat({ INPUT_RESULTSFORMAT: "json" }), "json");
});

test("requires BUILD_REPOSITORY_URI", () => {
  assert.throws(
    () => getScorecardArguments({}, "/task"),
    new Error("BUILD_REPOSITORY_URI environment variable is required"),
  );
});

test("rejects unsupported repository hosts before execution", () => {
  assert.throws(
    () =>
      getScorecardArguments(
        { BUILD_REPOSITORY_URI: "https://github.com/contoso/repository" },
        "/task",
      ),
    new Error("Unsupported BUILD_REPOSITORY_URI host: github.com"),
  );
});
