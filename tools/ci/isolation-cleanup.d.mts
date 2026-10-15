interface CommandResult {
  status: number | null;
  stdout: string;
  error?: Error;
}
export function cleanup(run?: (args: string[]) => CommandResult): boolean;
