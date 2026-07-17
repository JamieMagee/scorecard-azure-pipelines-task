import path from "node:path";
import { normalizeAzureRepositoryUri } from "./repository-url.mts";

export function getResultsFileName(env: NodeJS.ProcessEnv): string {
  const resultsFile = env["INPUT_RESULTSFILE"];
  if (resultsFile) {
    return resultsFile;
  }
  if (env["INPUT_RESULTSFORMAT"] === "json") {
    return "scorecard-results.json";
  }
  return "scorecard-results.sarif";
}

export function getScorecardArguments(
  env: NodeJS.ProcessEnv,
  taskDirectory: string,
): string[] {
  const repository = env["BUILD_REPOSITORY_URI"];
  if (!repository) {
    throw new Error("BUILD_REPOSITORY_URI environment variable is required");
  }

  const resultsFormat = env["INPUT_RESULTSFORMAT"] || "sarif";
  const resultsPolicy =
    env["INPUT_RESULTSPOLICY"] || path.join(taskDirectory, "policy.yml");

  return [
    "--repo",
    normalizeAzureRepositoryUri(repository),
    "--format",
    resultsFormat,
    "--output",
    getResultsFileName(env),
    "--policy",
    resultsPolicy,
  ];
}
