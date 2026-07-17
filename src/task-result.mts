export function getTaskCompletionMessages(exitCode: number): string[] {
  if (exitCode === 0) {
    return ["Scorecard task completed successfully!"];
  }

  return [
    `##vso[task.logissue type=warning]Scorecard process exited with code ${exitCode}`,
    `##vso[task.complete result=SucceededWithIssues;]Scorecard exited with code ${exitCode}; valid results were uploaded.`,
  ];
}
