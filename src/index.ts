import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import * as tar from "tar";

const url =
  "https://github.com/ossf/scorecard/releases/download/v5.0.0/scorecard_5.0.0_linux_amd64.tar.gz";
const downloadPath = path.join(
  import.meta.dirname,
  "scorecard_5.0.0_linux_amd64.tar.gz",
);
const extractPath = path.join(import.meta.dirname, "scorecard");

async function downloadFile(url: string, dest: string): Promise<void> {
  const { body } = await fetch(url);
  const fileStream = fs.createWriteStream(dest);
  await finished(Readable.fromWeb(body).pipe(fileStream));
}

function extractTarGz(filePath: string, dest: string): Promise<void> {
  fs.mkdirSync(dest, { recursive: true });
  return tar.x({
    file: filePath,
    cwd: dest,
    gzip: true,
  });
}

function runScorecard(): void {
  exec(path.join(extractPath, "scorecard-linux-amd64"), (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing scorecard: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

async function main() {
  try {
    await downloadFile(url, downloadPath);
    await extractTarGz(downloadPath, extractPath);
    console.log("Scorecard downloaded and extracted successfully.");
    runScorecard();
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
