type JsonObject = Record<string, unknown>;

function requireObject(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid SARIF: ${path} must be an object`);
  }
  return value as JsonObject;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid SARIF: ${path} must be an array`);
  }
  return value;
}

function requireNonemptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid SARIF: ${path} must be a nonempty string`);
  }
  return value;
}

function requireMessage(value: unknown, path: string): void {
  const message = requireObject(value, path);
  const text =
    typeof message["text"] === "string" && message["text"].length > 0
      ? message["text"]
      : undefined;
  const markdown =
    typeof message["markdown"] === "string" && message["markdown"].length > 0
      ? message["markdown"]
      : undefined;
  if (!text && !markdown) {
    throw new Error(
      `Invalid SARIF: ${path} must contain nonempty text or markdown`,
    );
  }
}

function getRunCategory(run: JsonObject, runPath: string): string {
  const automationDetails = requireObject(
    run["automationDetails"],
    `${runPath}.automationDetails`,
  );
  const id = requireNonemptyString(
    automationDetails["id"],
    `${runPath}.automationDetails.id`,
  );
  const category = id.split("/")[1];
  if (!category) {
    throw new Error(
      `Invalid SARIF: ${runPath}.automationDetails.id must contain a run category`,
    );
  }
  return `scorecard-${category}`;
}

function prepareRun(value: unknown, runIndex: number): string {
  const runPath = `runs[${runIndex}]`;
  const run = requireObject(value, runPath);
  const tool = requireObject(run["tool"], `${runPath}.tool`);
  const driver = requireObject(tool["driver"], `${runPath}.tool.driver`);
  const rules = requireArray(driver["rules"], `${runPath}.tool.driver.rules`);
  const results = requireArray(run["results"], `${runPath}.results`);
  requireNonemptyString(driver["name"], `${runPath}.tool.driver.name`);

  const semanticVersion =
    typeof driver["semanticVersion"] === "string" &&
    driver["semanticVersion"].length > 0
      ? driver["semanticVersion"]
      : undefined;
  const version =
    typeof driver["version"] === "string" && driver["version"].length > 0
      ? driver["version"]
      : undefined;
  const normalizedVersion = (semanticVersion ?? version)?.replace(/^v/i, "");
  if (!normalizedVersion) {
    throw new Error(
      `Invalid SARIF: ${runPath}.tool.driver must have a nonempty version or semanticVersion`,
    );
  }
  driver["version"] = normalizedVersion;
  driver["semanticVersion"] = normalizedVersion;

  const category = getRunCategory(run, runPath);
  const properties =
    run["properties"] === undefined
      ? {}
      : requireObject(run["properties"], `${runPath}.properties`);
  properties["category"] = category;
  run["properties"] = properties;

  const ruleIds = rules.map((ruleValue, ruleIndex) => {
    const rulePath = `${runPath}.tool.driver.rules[${ruleIndex}]`;
    const rule = requireObject(ruleValue, rulePath);
    return requireNonemptyString(rule["id"], `${rulePath}.id`);
  });

  for (const [resultIndex, resultValue] of results.entries()) {
    const resultPath = `${runPath}.results[${resultIndex}]`;
    const result = requireObject(resultValue, resultPath);
    const ruleIndex = result["ruleIndex"];
    const ruleId = result["ruleId"];

    requireMessage(result["message"], `${resultPath}.message`);
    if (ruleId !== undefined) {
      requireNonemptyString(ruleId, `${resultPath}.ruleId`);
    }
    if (ruleIndex === undefined) {
      continue;
    }
    if (
      typeof ruleIndex !== "number" ||
      !Number.isInteger(ruleIndex) ||
      ruleIndex < 0
    ) {
      throw new Error(
        `Invalid SARIF: ${resultPath}.ruleIndex must be a nonnegative integer`,
      );
    }
    if (ruleIndex >= ruleIds.length) {
      throw new Error(
        `Invalid SARIF: ${resultPath}.ruleIndex ${ruleIndex} is out of range for ${ruleIds.length} rules`,
      );
    }
    if (ruleId !== undefined && ruleIds[ruleIndex] !== ruleId) {
      throw new Error(
        `Invalid SARIF: ${resultPath}.ruleIndex points to "${ruleIds[ruleIndex]}", not "${ruleId}"`,
      );
    }
  }

  return category;
}

export function prepareSarifForAdvancedSecurity(content: string): string {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SARIF JSON: ${reason}`);
  }

  const sarif = requireObject(value, "root");
  if (sarif["version"] !== "2.1.0") {
    throw new Error('Invalid SARIF: version must be "2.1.0"');
  }
  const runs = requireArray(sarif["runs"], "runs");
  if (runs.length === 0) {
    throw new Error("Invalid SARIF: runs must not be empty");
  }

  const categories = new Set<string>();
  for (const [runIndex, run] of runs.entries()) {
    const category = prepareRun(run, runIndex);
    if (categories.has(category)) {
      throw new Error(`Invalid SARIF: duplicate run category "${category}"`);
    }
    categories.add(category);
  }

  return JSON.stringify(sarif, null, 2);
}
