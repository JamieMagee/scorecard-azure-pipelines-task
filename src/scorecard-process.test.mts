import assert from "node:assert/strict";
import process from "node:process";
import { test } from "node:test";
import { runScorecardProcess } from "./scorecard-process.mts";

test("returns a successful exit code", async () => {
  const exitCode = await runScorecardProcess(
    process.execPath,
    ["-e", "process.exit(0)"],
    process.env,
  );
  assert.equal(exitCode, 0);
});

test("returns a nonzero exit code", async () => {
  const exitCode = await runScorecardProcess(
    process.execPath,
    ["-e", "process.exit(7)"],
    process.env,
  );
  assert.equal(exitCode, 7);
});

test("rejects when the process cannot start", async () => {
  await assert.rejects(
    runScorecardProcess(
      "scorecard-executable-that-does-not-exist",
      [],
      process.env,
    ),
    /Failed to start Scorecard process:/,
  );
});

test("rejects when the process is terminated by a signal", async () => {
  await assert.rejects(
    runScorecardProcess(
      process.execPath,
      ["-e", 'process.kill(process.pid, "SIGTERM")'],
      process.env,
    ),
    new Error("Scorecard process terminated by signal SIGTERM"),
  );
});
