import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function downloadToFile(
  url: string,
  destination: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error(`No response body for ${url}`);
    }

    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(destination),
    );
  } catch (error) {
    try {
      await fs.promises.rm(destination, { force: true });
    } catch {
      // Preserve the original download error.
    }
    throw error;
  }
}
