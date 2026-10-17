export type ExitCode = 0 | 2 | 3 | 4 | 5;

export class TaskToolError extends Error {
  readonly exitCode: Exclude<ExitCode, 0>;

  constructor(exitCode: Exclude<ExitCode, 0>, message: string) {
    super(message);
    this.name = "TaskToolError";
    this.exitCode = exitCode;
  }
}
