import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAzureRepositoryUri } from "./repository-url.mts";

test("normalizes Azure DevOps repository URLs", async (t) => {
  const cases = [
    {
      name: "canonical URL",
      input: "https://dev.azure.com/contoso/project/_git/repository",
      expected: "https://dev.azure.com/contoso/project/_git/repository",
    },
    {
      name: "canonical URL with user information",
      input: "https://contoso@dev.azure.com/contoso/project/_git/repository",
      expected: "https://dev.azure.com/contoso/project/_git/repository",
    },
    {
      name: "legacy Visual Studio URL",
      input: "https://contoso.visualstudio.com/project/_git/repository",
      expected: "https://dev.azure.com/contoso/project/_git/repository",
    },
    {
      name: "encoded project and repository names",
      input: "https://contoso.visualstudio.com/Project%20Name/_git/Repo%20Name",
      expected: "https://dev.azure.com/contoso/Project%20Name/_git/Repo%20Name",
    },
    {
      name: "query and fragment are removed",
      input:
        "https://dev.azure.com/contoso/project/_git/repository?version=1#readme",
      expected: "https://dev.azure.com/contoso/project/_git/repository",
    },
    {
      name: "_git matching is case-insensitive",
      input: "https://contoso.visualstudio.com/project/_GIT/repository",
      expected: "https://dev.azure.com/contoso/project/_git/repository",
    },
  ] as const;

  for (const testcase of cases) {
    await t.test(testcase.name, () => {
      assert.equal(
        normalizeAzureRepositoryUri(testcase.input),
        testcase.expected,
      );
    });
  }
});

test("rejects unsupported or malformed repository URLs", async (t) => {
  const cases = [
    {
      name: "relative URL",
      input: "dev.azure.com/contoso/project/_git/repository",
      message: "BUILD_REPOSITORY_URI must be a valid absolute URL",
    },
    {
      name: "non-HTTPS URL",
      input: "http://dev.azure.com/contoso/project/_git/repository",
      message: "BUILD_REPOSITORY_URI must use HTTPS",
    },
    {
      name: "URL with port",
      input: "https://dev.azure.com:8443/contoso/project/_git/repository",
      message: "BUILD_REPOSITORY_URI must not specify a port",
    },
    {
      name: "unsupported host",
      input: "https://github.com/contoso/repository",
      message: "Unsupported BUILD_REPOSITORY_URI host: github.com",
    },
    {
      name: "nested Visual Studio host",
      input: "https://foo.bar.visualstudio.com/project/_git/repository",
      message:
        "Unsupported BUILD_REPOSITORY_URI host: foo.bar.visualstudio.com",
    },
    {
      name: "canonical URL missing repository",
      input: "https://dev.azure.com/contoso/project/_git",
      message:
        "Invalid BUILD_REPOSITORY_URI path for dev.azure.com; expected /<organization>/<project>/_git/<repository>",
    },
    {
      name: "canonical URL missing _git",
      input: "https://dev.azure.com/contoso/project/repository",
      message:
        "Invalid BUILD_REPOSITORY_URI path for dev.azure.com; expected /<organization>/<project>/_git/<repository>",
    },
    {
      name: "legacy URL missing repository",
      input: "https://contoso.visualstudio.com/project/_git",
      message:
        "Invalid BUILD_REPOSITORY_URI path for contoso.visualstudio.com; expected /<project>/_git/<repository>",
    },
    {
      name: "legacy URL with extra path segment",
      input: "https://contoso.visualstudio.com/project/_git/repository/extra",
      message:
        "Invalid BUILD_REPOSITORY_URI path for contoso.visualstudio.com; expected /<project>/_git/<repository>",
    },
  ] as const;

  for (const testcase of cases) {
    await t.test(testcase.name, () => {
      assert.throws(
        () => normalizeAzureRepositoryUri(testcase.input),
        new Error(testcase.message),
      );
    });
  }
});
