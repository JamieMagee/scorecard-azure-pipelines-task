import { spawn } from "node:child_process";

export function runScorecardProcess(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env,
      stdio: "inherit",
    });

    child.once("close", (code, signal) => {
      if (code === null) {
        reject(
          new Error(
            `Scorecard process terminated by signal ${signal ?? "unknown"}`,
          ),
        );
        return;
      }
      resolve(code);
    });

    child.once("error", (error) => {
      reject(new Error(`Failed to start Scorecard process: ${error.message}`));
    });
  });
}
