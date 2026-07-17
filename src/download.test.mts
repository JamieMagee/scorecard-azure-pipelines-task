import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { downloadToFile } from "./download.mts";

async function testDestination(t: TestContext): Promise<string> {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "scorecard-download-"),
  );
  t.after(async () => {
    await fs.promises.rm(directory, { force: true, recursive: true });
  });
  return path.join(directory, "scorecard.tar.gz");
}

async function expectMissing(filename: string): Promise<void> {
  await assert.rejects(fs.promises.access(filename), { code: "ENOENT" });
}

test("streams response chunks to a closed destination", async (t) => {
  const destination = await testDestination(t);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("first-"));
      controller.enqueue(encoder.encode("second"));
      controller.close();
    },
  });

  await downloadToFile(
    "https://example.com/scorecard.tar.gz",
    destination,
    async () => new Response(body),
  );

  assert.equal(await fs.promises.readFile(destination, "utf8"), "first-second");
  await fs.promises.rm(destination);
  await expectMissing(destination);
});

test("removes the destination after a non-successful response", async (t) => {
  const destination = await testDestination(t);
  await fs.promises.writeFile(destination, "stale");

  await assert.rejects(
    downloadToFile(
      "https://example.com/scorecard.tar.gz",
      destination,
      async () =>
        new Response("not found", { status: 404, statusText: "Not Found" }),
    ),
    new Error(
      "Failed to fetch https://example.com/scorecard.tar.gz: Not Found",
    ),
  );
  await expectMissing(destination);
});

test("removes the destination when the response has no body", async (t) => {
  const destination = await testDestination(t);
  await fs.promises.writeFile(destination, "stale");

  await assert.rejects(
    downloadToFile(
      "https://example.com/scorecard.tar.gz",
      destination,
      async () => new Response(null),
    ),
    new Error("No response body for https://example.com/scorecard.tar.gz"),
  );
  await expectMissing(destination);
});

test("removes the destination when fetch rejects", async (t) => {
  const destination = await testDestination(t);
  await fs.promises.writeFile(destination, "stale");
  const fetchError = new Error("fetch failed");

  await assert.rejects(
    downloadToFile(
      "https://example.com/scorecard.tar.gz",
      destination,
      async () => {
        throw fetchError;
      },
    ),
    fetchError,
  );
  await expectMissing(destination);
});

test("removes a partial file and preserves a stream error", async (t) => {
  const destination = await testDestination(t);
  const streamError = new Error("stream failed");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("partial"));
      controller.error(streamError);
    },
  });

  await assert.rejects(
    downloadToFile(
      "https://example.com/scorecard.tar.gz",
      destination,
      async () => new Response(body),
    ),
    streamError,
  );
  await expectMissing(destination);
});

test("preserves a destination write error", async (t) => {
  const destination = await testDestination(t);
  const missingParentDestination = path.join(
    path.dirname(destination),
    "missing",
    "scorecard.tar.gz",
  );

  await assert.rejects(
    downloadToFile(
      "https://example.com/scorecard.tar.gz",
      missingParentDestination,
      async () => new Response("content"),
    ),
    { code: "ENOENT" },
  );
  await expectMissing(missingParentDestination);
});
