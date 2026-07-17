import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { create } from "tar/create";
import { extractScorecardArchive } from "./extract.mts";

async function testDirectory(t: TestContext): Promise<string> {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "scorecard-extract-test-"),
  );
  t.after(async () => {
    await fs.promises.rm(directory, { force: true, recursive: true });
  });
  return directory;
}

async function createArchive(
  root: string,
  files: Record<string, string>,
): Promise<string> {
  const source = path.join(root, "source");
  await fs.promises.mkdir(source);
  for (const [filename, content] of Object.entries(files)) {
    await fs.promises.writeFile(path.join(source, filename), content);
  }

  const archive = path.join(root, "scorecard.tar.gz");
  await create(
    {
      cwd: source,
      file: archive,
      gzip: true,
    },
    Object.keys(files),
  );
  return archive;
}

async function extractionDirectories(root: string): Promise<string[]> {
  return (await fs.promises.readdir(root)).filter((entry) =>
    entry.startsWith("scorecard-"),
  );
}

test("extracts the Linux binary and filters unrelated files", async (t) => {
  const root = await testDirectory(t);
  const archive = await createArchive(root, {
    README: "filtered",
    scorecard: "linux binary",
  });

  const extracted = await extractScorecardArchive(archive, root, "linux");

  assert.match(path.basename(extracted.directory), /^scorecard-/);
  assert.equal(
    await fs.promises.readFile(extracted.binaryPath, "utf8"),
    "linux binary",
  );
  await assert.rejects(
    fs.promises.access(path.join(extracted.directory, "README")),
    { code: "ENOENT" },
  );
});

test("selects scorecard.exe for Windows", async (t) => {
  const root = await testDirectory(t);
  const archive = await createArchive(root, {
    "scorecard.exe": "windows binary",
  });

  const extracted = await extractScorecardArchive(archive, root, "win32");

  assert.equal(path.basename(extracted.binaryPath), "scorecard.exe");
  assert.equal(
    await fs.promises.readFile(extracted.binaryPath, "utf8"),
    "windows binary",
  );
});

test("isolates concurrent extractions", async (t) => {
  const root = await testDirectory(t);
  const archive = await createArchive(root, {
    scorecard: "binary",
  });

  const [first, second] = await Promise.all([
    extractScorecardArchive(archive, root, "linux"),
    extractScorecardArchive(archive, root, "linux"),
  ]);

  assert.notEqual(first.directory, second.directory);
  assert.notEqual(first.binaryPath, second.binaryPath);
  await fs.promises.rm(first.directory, { recursive: true });
  await assert.rejects(fs.promises.access(first.binaryPath), {
    code: "ENOENT",
  });
  assert.equal(await fs.promises.readFile(second.binaryPath, "utf8"), "binary");
});

test("cleans the generated directory for an invalid archive", async (t) => {
  const root = await testDirectory(t);
  const archive = path.join(root, "invalid.tar.gz");
  await fs.promises.writeFile(archive, "not an archive");

  await assert.rejects(extractScorecardArchive(archive, root, "linux"));
  assert.deepEqual(await extractionDirectories(root), []);
});

test("cleans the generated directory when the binary is missing", async (t) => {
  const root = await testDirectory(t);
  const archive = await createArchive(root, {
    README: "no binary",
  });

  await assert.rejects(extractScorecardArchive(archive, root, "linux"));
  assert.deepEqual(await extractionDirectories(root), []);
});
