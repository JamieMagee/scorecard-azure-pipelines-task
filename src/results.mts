import { prepareSarifForAdvancedSecurity } from "./sarif.mts";

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid JSON results: ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonemptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid JSON results: ${field} must be a nonempty string`);
  }
  return value;
}

function requireScore(value: unknown, field: string): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < -1 ||
    value > 10
  ) {
    throw new Error(
      `Invalid JSON results: ${field} must be a score from -1 to 10`,
    );
  }
}

function requireStringArray(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(
      `Invalid JSON results: ${field} must be an array of strings`,
    );
  }
}

function validateScorecardJson(value: unknown): void {
  const report = requireObject(value, "root");
  const date = requireNonemptyString(report["date"], "date");
  if (!Number.isFinite(Date.parse(date))) {
    throw new Error("Invalid JSON results: date must be a valid date");
  }
  const repo = requireObject(report["repo"], "repo");
  requireNonemptyString(repo["name"], "repo.name");
  requireNonemptyString(repo["commit"], "repo.commit");
  const scorecard = requireObject(report["scorecard"], "scorecard");
  requireNonemptyString(scorecard["version"], "scorecard.version");
  requireNonemptyString(scorecard["commit"], "scorecard.commit");
  requireScore(report["score"], "score");
  const checks = report["checks"];
  if (checks !== null && !Array.isArray(checks)) {
    throw new Error("Invalid JSON results: checks must be an array or null");
  }
  for (const [index, value] of (checks ?? []).entries()) {
    const field = `checks[${index}]`;
    const check = requireObject(value, field);
    requireNonemptyString(check["name"], `${field}.name`);
    requireScore(check["score"], `${field}.score`);
    if (!Number.isInteger(check["score"])) {
      throw new Error(
        `Invalid JSON results: ${field}.score must be an integer`,
      );
    }
    if (typeof check["reason"] !== "string") {
      throw new Error(`Invalid JSON results: ${field}.reason must be a string`);
    }
    const documentation = requireObject(
      check["documentation"],
      `${field}.documentation`,
    );
    requireNonemptyString(documentation["url"], `${field}.documentation.url`);
    if (typeof documentation["short"] !== "string") {
      throw new Error(
        `Invalid JSON results: ${field}.documentation.short must be a string`,
      );
    }
    if (check["details"] !== undefined && check["details"] !== null) {
      requireStringArray(check["details"], `${field}.details`);
    }
    if (check["annotations"] !== undefined) {
      requireStringArray(check["annotations"], `${field}.annotations`);
    }
  }
  if (report["metadata"] !== undefined && report["metadata"] !== null) {
    requireStringArray(report["metadata"], "metadata");
  }
}

export function prepareResultsForUpload(
  content: string,
  format: string,
): string {
  switch (format) {
    case "sarif":
      return prepareSarifForAdvancedSecurity(content);
    case "json": {
      if (!content.trim()) {
        throw new Error("Invalid JSON results: file is empty");
      }
      let value: unknown;
      try {
        value = JSON.parse(content);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON results: ${reason}`);
      }
      validateScorecardJson(value);
      return content;
    }
    default:
      throw new Error(`Unsupported results format: ${format}`);
  }
}
