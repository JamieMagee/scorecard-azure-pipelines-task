import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { prepareSarifForAdvancedSecurity } from "./sarif.mts";

const fixtureUrl = new URL(
  "./testdata/scorecard-multi-run.sarif",
  import.meta.url,
);
const fixtureContent = fs.readFileSync(fixtureUrl, "utf8");

function fixtureValue() {
  return JSON.parse(fixtureContent);
}

function prepare(value: unknown) {
  return JSON.parse(prepareSarifForAdvancedSecurity(JSON.stringify(value)));
}

test("preserves Scorecard multi-run SARIF", () => {
  const original = fixtureValue();
  const expected = structuredClone(original);
  const categories = [
    "scorecard-branch-protection",
    "scorecard-local",
    "scorecard-online-scm",
  ];
  for (const [index, run] of expected.runs.entries()) {
    run.tool.driver.version = "5.5.0";
    run.tool.driver.semanticVersion = "5.5.0";
    run.properties = {
      ...(run.properties ?? {}),
      category: categories[index],
    };
  }

  const prepared = prepare(original);

  assert.deepEqual(prepared, expected);
  assert.equal(prepared.runs.length, 3);
  assert.equal(
    prepared.runs.reduce(
      (count: number, run: { tool: { driver: { rules: unknown[] } } }) =>
        count + run.tool.driver.rules.length,
      0,
    ),
    13,
  );
  assert.equal(
    prepared.runs.reduce(
      (count: number, run: { results: unknown[] }) =>
        count + run.results.length,
      0,
    ),
    5,
  );
  assert.deepEqual(
    prepared.runs.map(
      (run: { properties: { category: string } }) => run.properties.category,
    ),
    categories,
  );
});

test("preserves empty results arrays", () => {
  const sarif = fixtureValue();
  sarif.runs[0].results = [];

  const prepared = prepare(sarif);

  assert.deepEqual(prepared.runs[0].results, []);
});

test("falls back to driver.version", () => {
  const sarif = fixtureValue();
  delete sarif.runs[0].tool.driver.semanticVersion;
  sarif.runs[0].tool.driver.version = "V5.5.0";

  const prepared = prepare(sarif);

  assert.equal(prepared.runs[0].tool.driver.version, "5.5.0");
  assert.equal(prepared.runs[0].tool.driver.semanticVersion, "5.5.0");
});

test("rejects invalid JSON", () => {
  assert.throws(
    () => prepareSarifForAdvancedSecurity("{"),
    /^Error: Invalid SARIF JSON:/,
  );
});

test("rejects unsupported SARIF versions", () => {
  const sarif = fixtureValue();
  sarif.version = "2.0.0";

  assert.throws(
    () => prepare(sarif),
    new Error('Invalid SARIF: version must be "2.1.0"'),
  );
});

test("rejects missing or empty runs", () => {
  const missingRuns = fixtureValue();
  delete missingRuns.runs;
  assert.throws(
    () => prepare(missingRuns),
    new Error("Invalid SARIF: runs must be an array"),
  );

  const emptyRuns = fixtureValue();
  emptyRuns.runs = [];
  assert.throws(
    () => prepare(emptyRuns),
    new Error("Invalid SARIF: runs must not be empty"),
  );
});

test("rejects invalid rule indices", () => {
  const noninteger = fixtureValue();
  noninteger.runs[0].results[0].ruleIndex = 0.5;
  assert.throws(
    () => prepare(noninteger),
    new Error(
      "Invalid SARIF: runs[0].results[0].ruleIndex must be a nonnegative integer",
    ),
  );

  const outOfRange = fixtureValue();
  outOfRange.runs[0].results[0].ruleIndex = 1;
  assert.throws(
    () => prepare(outOfRange),
    new Error(
      "Invalid SARIF: runs[0].results[0].ruleIndex 1 is out of range for 1 rules",
    ),
  );

  const mismatch = fixtureValue();
  mismatch.runs[1].results[0].ruleIndex = 5;
  assert.throws(
    () => prepare(mismatch),
    new Error(
      'Invalid SARIF: runs[1].results[0].ruleIndex points to "SASTID", not "DependencyUpdateToolID"',
    ),
  );
});

test("rejects missing run structure", () => {
  const missingAutomationDetails = fixtureValue();
  delete missingAutomationDetails.runs[0].automationDetails;
  assert.throws(
    () => prepare(missingAutomationDetails),
    new Error("Invalid SARIF: runs[0].automationDetails must be an object"),
  );

  const missingAutomationID = fixtureValue();
  delete missingAutomationID.runs[0].automationDetails.id;
  assert.throws(
    () => prepare(missingAutomationID),
    new Error(
      "Invalid SARIF: runs[0].automationDetails.id must be a nonempty string",
    ),
  );

  const missingCategory = fixtureValue();
  missingCategory.runs[0].automationDetails.id = "scorecard";
  assert.throws(
    () => prepare(missingCategory),
    new Error(
      "Invalid SARIF: runs[0].automationDetails.id must contain a run category",
    ),
  );

  const invalidProperties = fixtureValue();
  invalidProperties.runs[0].properties = "invalid";
  assert.throws(
    () => prepare(invalidProperties),
    new Error("Invalid SARIF: runs[0].properties must be an object"),
  );

  const missingDriverName = fixtureValue();
  delete missingDriverName.runs[0].tool.driver.name;
  assert.throws(
    () => prepare(missingDriverName),
    new Error(
      "Invalid SARIF: runs[0].tool.driver.name must be a nonempty string",
    ),
  );

  const missingDriver = fixtureValue();
  delete missingDriver.runs[0].tool.driver;
  assert.throws(
    () => prepare(missingDriver),
    new Error("Invalid SARIF: runs[0].tool.driver must be an object"),
  );

  const missingRules = fixtureValue();
  delete missingRules.runs[0].tool.driver.rules;
  assert.throws(
    () => prepare(missingRules),
    new Error("Invalid SARIF: runs[0].tool.driver.rules must be an array"),
  );

  const missingResults = fixtureValue();
  delete missingResults.runs[0].results;
  assert.throws(
    () => prepare(missingResults),
    new Error("Invalid SARIF: runs[0].results must be an array"),
  );

  const missingVersion = fixtureValue();
  delete missingVersion.runs[0].tool.driver.semanticVersion;
  assert.throws(
    () => prepare(missingVersion),
    new Error(
      "Invalid SARIF: runs[0].tool.driver must have a nonempty version or semanticVersion",
    ),
  );

  const missingMessage = fixtureValue();
  delete missingMessage.runs[0].results[0].message;
  assert.throws(
    () => prepare(missingMessage),
    new Error("Invalid SARIF: runs[0].results[0].message must be an object"),
  );

  const emptyMessage = fixtureValue();
  emptyMessage.runs[0].results[0].message = {};
  assert.throws(
    () => prepare(emptyMessage),
    new Error(
      "Invalid SARIF: runs[0].results[0].message must contain nonempty text or markdown",
    ),
  );
});

test("rejects duplicate run categories", () => {
  const sarif = fixtureValue();
  sarif.runs[1].automationDetails.id =
    "supply-chain/branch-protection/another-run";

  assert.throws(
    () => prepare(sarif),
    new Error(
      'Invalid SARIF: duplicate run category "scorecard-branch-protection"',
    ),
  );
});
