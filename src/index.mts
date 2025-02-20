import { spawn } from "node:child_process";
import console from "node:console";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { extract } from "tar/extract";

/**
 * Get the latest version of Scorecard from GitHub.
 * @async
 * @returns {Promise<string>} The latest version tag.
 * @throws {Error} If the fetch fails.
 */
async function getLatestVersion(): Promise<string> {
  const response = await fetch(
    "https://api.github.com/repos/ossf/scorecard/releases/latest",
  );
  if (!response.ok) {
    throw new Error(`Error fetching latest version: ${response.statusText}`);
  }
  const data = (await response.json()) as { tag_name: string };
  return data.tag_name;
}

/**
 * Get the current operating system.
 * @returns { "darwin" | "linux" | "windows" } The current operating system.
 * @throws {Error} If the operating system is unsupported.
 */
function getOs(): "darwin" | "linux" | "windows" {
  switch (os.platform()) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported OS: ${os.platform()}`);
  }
}

/**
 * Get the current architecture.
 * @returns { "amd64" | "arm64" } The current architecture.
 * @throws {Error} If the architecture is unsupported.
 */
function getArch(): "amd64" | "arm64" {
  switch (os.arch()) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported architecture: ${os.arch()}`);
  }
}

/**
 * Get the download URL for the Scorecard binary.
 * @async
 * @returns {Promise<string>} The download URL for the Scorecard binary.
 */
async function getDownloadUrl(): Promise<string> {
  const version = await getLatestVersion();
  const os = getOs();
  const arch = getArch();
  return `https://github.com/ossf/scorecard/releases/download/${version}/scorecard_${version.substring(
    1,
  )}_${os}_${arch}.tar.gz`;
}

/**
 * Download a file from a URL to a destination path.
 * @async
 * @param url The URL to download from.
 * @returns {Promise<void>} A promise that resolves when the download is complete.
 * @throws {Error} If the fetch fails.
 */
async function downloadFile(url: string): Promise<void> {
  const filename = path.basename(url);
  const { body } = await fetch(url);
  if (!body) {
    throw new Error(`Failed to fetch ${url}`);
  }
  const fileStream = fs.createWriteStream(filename);
  await finished(Readable.fromWeb(body).pipe(fileStream));
}

/**
 * Verify the checksum of the downloaded Scorecard binary.
 * @async
 * @param downloadUrl The URL to the Scorecard download.
 * @returns {Promise<void>} A promise that resolves when the checksum is verified.
 * @throws {Error} If the checksum verification fails.
 */
async function verifyChecksum(downloadUrl: string): Promise<void> {
  const checksumUrl = `${path.dirname(downloadUrl)}/scorecard_checksums.txt`;
  const response = await fetch(checksumUrl);
  if (!response.ok) {
    throw new Error(`Error fetching checksum file: ${response.statusText}`);
  }
  const checksumData = await response.text();

  const checksumLines = checksumData.split("\n");
  const filename = path.basename(downloadUrl);
  const expectedChecksum = checksumLines
    .find((line) => line.includes(filename))
    ?.split(" ")[0];

  if (!expectedChecksum) {
    throw new Error(`Checksum not found for ${downloadUrl}`);
  }

  const fileBuffer = fs.readFileSync(filename);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  if (hash !== expectedChecksum) {
    throw new Error(`Checksum verification failed for ${filename}`);
  }
}

/**
 * Extract a .tar.gz file to a destination directory.
 * @async
 * @param filePath The path to the .tar.gz file.
 * @returns {Promise<string>} The path to the extracted Scorecard binary.
 */
async function extractTarGz(filePath: string): Promise<string> {
  const dest = path.join(os.tmpdir(), "scorecard");
  fs.mkdirSync(dest, { recursive: true });
  await extract({
    file: filePath,
    cwd: dest,
    gzip: true,
    filter: (file) => file.startsWith("scorecard"),
  });
  const suffix = getOs() === "windows" ? ".exe" : "";
  return path.join(dest, "scorecard", suffix);
}

/**
 * Get the path to the results file.
 * Uses the `INPUT_RESULTSFILE` environment variable.
 * If not set, defaults to `results.sarif` or `results.json` based on the `INPUT_RESULTSFORMAT` environment variable.
 * @returns {string} The path to the results file.
 */
function getResultsFileName(): string {
  const resultsFile = process.env["INPUT_RESULTSFILE"];
  if (resultsFile) {
    return resultsFile;
  }
  const resultsFormat = process.env["INPUT_RESULTSFORMAT"];
  if (resultsFormat === "sarif") {
    return "results.sarif";
  }
  return "results.json";
}

/**
 * Get the arguments to pass to the Scorecard binary.
 * @returns {string[]} The arguments to pass to the Scorecard binary.
 */
function getArguments(): string[] {
  const args: string[] = [];

  const repository = process.env["BUILD_REPOSITORY_URI"];
  if (repository) {
    args.push("--repo", repository);
  }

  const resultsFormat = process.env["INPUT_RESULTSFORMAT"];
  if (resultsFormat) {
    args.push("--format", resultsFormat);
  }

  args.push("--output", getResultsFileName());

  const resultsPolicy = process.env["INPUT_RESULTSPOLICY"];
  if (resultsPolicy) {
    args.push("--policy", resultsPolicy);
  } else {
    args.push("--policy", path.join(import.meta.dirname, "policy.yml"));
  }

  return args;
}

/**
 * Run the Scorecard binary.
 * @async
 * @param binary The path to the Scorecard binary.
 * @returns {Promise<void>} A promise that resolves when the command is executed.
 */
async function runScorecard(binary: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, getArguments(), {
      env: {
        AZURE_DEVOPS_AUTH_TOKEN: process.env["INPUT_REPOTOKEN"],
        SCORECARD_EXPERIMENTAL: "true",
        ENABLE_SARIF: "true",
      },
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Scorecard process exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Upload the results to Azure DevOps.
 * @see https://learn.microsoft.com/azure/devops/pipelines/scripts/logging-commands#upload-upload-an-artifact
 */
function uploadResults(): void {
  const resultsFileName = getResultsFileName();
  const resultsFile = path.join(process.cwd(), resultsFileName);
  console.log(
    `##vso[artifact.upload artifactname=${resultsFileName};]${resultsFile}`,
  );
}

/**
 * The main entrypoint of the task.
 * @async
 * @returns {Promise<void>} A promise that resolves when the task is complete.
 */
async function run(): Promise<void> {
  const downloadUrl = await getDownloadUrl();
  await downloadFile(downloadUrl);
  await verifyChecksum(downloadUrl);
  const binary = await extractTarGz(path.basename(downloadUrl));
  await runScorecard(binary);
  uploadResults();
}

// Run the main function
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
