import console from "node:console";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  getResultsFileName,
  getResultsFormat,
  getScorecardArguments,
} from "./arguments.mts";
import { downloadToFile } from "./download.mts";
import { extractScorecardArchive } from "./extract.mts";
import { prepareResultsForUpload } from "./results.mts";
import { runScorecardProcess } from "./scorecard-process.mts";
import { getTaskCompletionMessages } from "./task-result.mts";

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
 * @returns {Promise<string>} A promise that resolves with the downloaded filename.
 * @throws {Error} If the fetch fails.
 */
async function downloadFile(url: string): Promise<string> {
  const filename = path.basename(new URL(url).pathname);
  await downloadToFile(url, filename);
  return filename;
}

/**
 * Verify the checksum of the downloaded Scorecard binary.
 * @async
 * @param downloadUrl The URL to the Scorecard download.
 * @param filename The downloaded filename.
 * @returns {Promise<void>} A promise that resolves when the checksum is verified.
 * @throws {Error} If the checksum verification fails.
 */
async function verifyChecksum(
  downloadUrl: string,
  filename: string,
): Promise<void> {
  const checksumUrl = `${path.dirname(downloadUrl)}/scorecard_checksums.txt`;
  const response = await fetch(checksumUrl);
  if (!response.ok) {
    throw new Error(`Error fetching checksum file: ${response.statusText}`);
  }
  const checksumData = await response.text();

  const checksumLines = checksumData.split("\n");
  const expectedChecksum = checksumLines
    .find((line) => line.includes(path.basename(filename)))
    ?.split(" ")[0];

  if (!expectedChecksum) {
    throw new Error(`Checksum not found for ${filename}`);
  }

  const fileBuffer = await fs.promises.readFile(filename);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  if (hash !== expectedChecksum) {
    throw new Error(
      `Checksum verification failed for ${filename}. Expected: ${expectedChecksum}, Got: ${hash}`,
    );
  }
}

/**
 * Validate and prepare the Scorecard result file for upload.
 */
async function prepareResultsFileForUpload(): Promise<void> {
  const resultsFormat = getResultsFormat(process.env);
  const resultsFile = path.join(process.cwd(), getResultsFileName(process.env));
  let content: string;
  try {
    content = await fs.promises.readFile(resultsFile, "utf-8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read results file ${resultsFile}: ${reason}`);
  }
  const prepared = prepareResultsForUpload(content, resultsFormat);
  if (prepared !== content) {
    await fs.promises.writeFile(resultsFile, prepared);
  }
  console.log(`Prepared ${resultsFormat.toUpperCase()} results for upload`);
}

/**
 * Upload the results to Azure DevOps.
 * @see https://learn.microsoft.com/azure/devops/pipelines/scripts/logging-commands#upload-upload-an-artifact
 */
async function uploadResults(): Promise<void> {
  const resultsFileName = getResultsFileName(process.env);
  const resultsFile = path.join(process.cwd(), resultsFileName);

  // Verify the results file exists before uploading
  try {
    await fs.promises.access(resultsFile);
    console.log(
      `##vso[artifact.upload artifactname=${resultsFileName};]${resultsFile}`,
    );
  } catch {
    throw new Error(`Results file not found: ${resultsFile}`);
  }
}

/**
 * Clean up temporary files and directories.
 * @param filePaths The file paths to clean up.
 * @param directoryPaths The directory paths to clean up recursively.
 */
async function cleanup(
  filePaths: string[],
  directoryPaths: string[],
): Promise<void> {
  await Promise.allSettled([
    ...filePaths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up: ${filePath}`);
      } catch {
        // Ignore cleanup errors
      }
    }),
    ...directoryPaths.map(async (directoryPath) => {
      try {
        await fs.promises.rm(directoryPath, {
          force: true,
          recursive: true,
        });
        console.log(`Cleaned up: ${directoryPath}`);
      } catch {
        // Ignore cleanup errors
      }
    }),
  ]);
}

/**
 * The main entrypoint of the task.
 * @async
 * @returns {Promise<number>} The Scorecard process exit code.
 */
async function run(): Promise<number> {
  const tempFiles: string[] = [];
  const tempDirectories: string[] = [];
  try {
    console.log("Starting Scorecard Azure Pipelines task...");
    const scorecardArguments = getScorecardArguments(
      process.env,
      import.meta.dirname,
    );

    const downloadUrl = await getDownloadUrl();
    console.log(`Downloading Scorecard from: ${downloadUrl}`);

    const filename = await downloadFile(downloadUrl);
    tempFiles.push(filename);
    console.log(`Downloaded: ${filename}`);

    console.log("Verifying checksum...");
    await verifyChecksum(downloadUrl, filename);

    console.log("Extracting binary...");
    const extracted = await extractScorecardArchive(filename);
    tempDirectories.push(extracted.directory);
    const binary = extracted.binaryPath;

    console.log("Running Scorecard...");
    console.log(`Running: ${binary} ${scorecardArguments.join(" ")}`);
    const scorecardExitCode = await runScorecardProcess(
      binary,
      scorecardArguments,
      {
        ...process.env,
        AZURE_DEVOPS_AUTH_TOKEN: process.env["INPUT_REPOTOKEN"],
        SCORECARD_EXPERIMENTAL: "true",
        ENABLE_SARIF: "true",
      },
    );

    await prepareResultsFileForUpload();

    console.log("Uploading results...");
    await uploadResults();

    return scorecardExitCode;
  } catch (error) {
    console.error("Scorecard task failed:", error);
    throw error;
  } finally {
    await cleanup(tempFiles, tempDirectories);
  }
}

// Run the main function
run()
  .then((exitCode) => {
    for (const message of getTaskCompletionMessages(exitCode)) {
      console.log(message);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
