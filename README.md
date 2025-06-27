# OSSF Scorecard Azure Pipelines Task

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/JamieMagee.scorecard?style=for-the-badge&color=blue)](https://marketplace.visualstudio.com/items?itemName=JamieMagee.scorecard)
[![OSSF-Scorecard Score](https://img.shields.io/ossf-scorecard/github.com/JamieMagee/scorecard-azure-pipelines-task?style=for-the-badge)](https://scorecard.dev/viewer/?uri=github.com/JamieMagee/scorecard-azure-pipelines-task)

An Azure Pipelines task that runs [OpenSSF Scorecard](https://scorecard.dev/) to evaluate the security posture of your repository.

## What is OpenSSF Scorecard?

OpenSSF Scorecard is an automated tool that assesses projects for security risks through a series of checks. It evaluates projects based on security practices and provides a score and recommendations for improvement. For detailed information about each check, visit the [Scorecard documentation](https://github.com/ossf/scorecard/blob/main/docs/checks.md).

## Quick Start

Add the following task to your Azure Pipeline:

```yaml
- task: Scorecard@0
  displayName: 'Run OpenSSF Scorecard'
```

## Task Inputs

| Input           | Required | Default                 | Description                                         |
|-----------------|----------|-------------------------|-----------------------------------------------------|
| `repoToken`     | Yes      | `$(System.AccessToken)` | Azure DevOps PAT with read access to the repository |
| `resultsFormat` | No       | `sarif`                 | Output format for results (`sarif` or `json`)       |
| `resultsFile`   | No       | Auto-generated          | Path where results will be saved                    |

### Inputs

#### `repoToken`

The Azure DevOps Personal Access Token used to access the repository. The default [`$(System.AccessToken)`](https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml#systemaccesstoken) is automatically provided by Azure DevOps and has appropriate permissions for most scenarios.

#### `resultsFormat`

Choose between:
- `sarif` - Static Analysis Results Interchange Format (recommended for integration with security tools)
- `json` - Standard JSON format

#### `resultsFile`

If not specified, the task will generate a filename based on the format:
- SARIF format: `scorecard-results.sarif`
- JSON format: `scorecard-results.json`

## Complete Pipeline Example

```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- checkout: self

- task: Scorecard@0
  displayName: 'Run OpenSSF Scorecard'
  inputs:
    repoToken: $(System.AccessToken)
    resultsFormat: 'sarif'
    resultsFile: 'scorecard-results.sarif'

- task: AdvancedSecurity-Publish@1
  displayName: 'Publish Scorecard Results'
```

### Integration with GitHub Advanced Security for Azure DevOps

The Scorecard task integrates with [GitHub Advanced Security for Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/repos/security/configure-github-advanced-security-features) through the [`AdvancedSecurity-Publish@1`](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/advanced-security-publish-v1?view=azure-pipelines) task. This integration allows you to view OpenSSF Scorecard security findings directly in Azure DevOps alongside other security scanning results.

For more information, see [Integrate non-Microsoft scanning tools](https://learn.microsoft.com/en-us/azure/devops/repos/security/github-advanced-security-code-scanning-third-party) in the Azure DevOps documentation.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [OpenSSF Scorecard](https://github.com/ossf/scorecard) - The main Scorecard project
- [Scorecard GitHub Action](https://github.com/ossf/scorecard-action) - GitHub Action version
- [Scorecard Monitor](https://github.com/ossf/scorecard-monitor) - Continuous monitoring tool
