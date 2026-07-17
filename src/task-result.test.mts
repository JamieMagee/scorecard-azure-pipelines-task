import assert from "node:assert/strict";
import { test } from "node:test";
import { getTaskCompletionMessages } from "./task-result.mts";

test("reports successful completion", () => {
  assert.deepEqual(getTaskCompletionMessages(0), [
    "Scorecard task completed successfully!",
  ]);
});

test("reports completion with issues", () => {
  assert.deepEqual(getTaskCompletionMessages(7), [
    "##vso[task.logissue type=warning]Scorecard process exited with code 7",
    "##vso[task.complete result=SucceededWithIssues;]Scorecard exited with code 7; valid results were uploaded.",
  ]);
});
