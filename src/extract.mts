import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extract } from "tar/extract";

export interface ExtractedScorecard {
  directory: string;
  binaryPath: string;
}

export async function extractScorecardArchive(
  archivePath: string,
  tempRoot: string = os.tmpdir(),
  platform: NodeJS.Platform = os.platform(),
): Promise<ExtractedScorecard> {
  const directory = await fs.promises.mkdtemp(
    path.join(tempRoot, "scorecard-"),
  );

  try {
    await extract({
      file: archivePath,
      cwd: directory,
      gzip: true,
      filter: (file) => file.startsWith("scorecard"),
    });

    const suffix = platform === "win32" ? ".exe" : "";
    const binaryPath = path.join(directory, `scorecard${suffix}`);
    await fs.promises.access(binaryPath);

    return { directory, binaryPath };
  } catch (error) {
    try {
      await fs.promises.rm(directory, { force: true, recursive: true });
    } catch {
      // Preserve the original extraction error.
    }
    throw error;
  }
}
