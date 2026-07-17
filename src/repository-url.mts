const azureDevOpsHost = "dev.azure.com";
const visualStudioHostSuffix = ".visualstudio.com";

function getPathSegments(url: URL): string[] {
  return url.pathname.split("/").slice(1);
}

function invalidPath(host: string, expected: string): never {
  throw new Error(
    `Invalid BUILD_REPOSITORY_URI path for ${host}; expected ${expected}`,
  );
}

export function normalizeAzureRepositoryUri(value: string): string {
  let repositoryUrl: URL;
  try {
    repositoryUrl = new URL(value);
  } catch {
    throw new Error("BUILD_REPOSITORY_URI must be a valid absolute URL");
  }

  if (repositoryUrl.protocol !== "https:") {
    throw new Error("BUILD_REPOSITORY_URI must use HTTPS");
  }
  if (repositoryUrl.port) {
    throw new Error("BUILD_REPOSITORY_URI must not specify a port");
  }

  const host = repositoryUrl.hostname;
  const segments = getPathSegments(repositoryUrl);

  let organization: string;
  let project: string;
  let repository: string;

  if (host === azureDevOpsHost) {
    const [organizationSegment, projectSegment, gitSegment, repositorySegment] =
      segments;
    if (
      segments.length !== 4 ||
      !organizationSegment ||
      !projectSegment ||
      gitSegment?.toLowerCase() !== "_git" ||
      !repositorySegment
    ) {
      invalidPath(host, "/<organization>/<project>/_git/<repository>");
    }

    organization = organizationSegment;
    project = projectSegment;
    repository = repositorySegment;
  } else if (host.endsWith(visualStudioHostSuffix)) {
    const organizationSegment = host.slice(0, -visualStudioHostSuffix.length);
    const [projectSegment, gitSegment, repositorySegment] = segments;
    if (!organizationSegment || organizationSegment.includes(".")) {
      throw new Error(`Unsupported BUILD_REPOSITORY_URI host: ${host}`);
    }
    if (
      segments.length !== 3 ||
      !projectSegment ||
      gitSegment?.toLowerCase() !== "_git" ||
      !repositorySegment
    ) {
      invalidPath(host, "/<project>/_git/<repository>");
    }

    organization = organizationSegment;
    project = projectSegment;
    repository = repositorySegment;
  } else {
    throw new Error(`Unsupported BUILD_REPOSITORY_URI host: ${host}`);
  }

  return `https://${azureDevOpsHost}/${organization}/${project}/_git/${repository}`;
}
