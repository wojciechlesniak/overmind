import { homedir } from "node:os";
import type { EngineVersion, NodeLock } from "./input.parse-boundary.ts";
import type { Runner } from "./runner.ts";
import type { StepName } from "./policy.ts";
import type { RuntimeLedger } from "./runtimeLicenses.parse-boundary.ts";

export interface PackageOptions {
  identity: string;
  out?: string;
  entitlements?: string;
  skipSign: boolean;
  checkReproducible: boolean;
  release: boolean;
}
export interface Context {
  root: string;
  work: string;
  out: string;
  runner: Runner;
  options: PackageOptions;
  lock: NodeLock;
  licenseLedger: RuntimeLedger;
  runtime: string;
  binary: string;
  dist: string;
  resources: string;
  entitlements: string;
  version?: EngineVersion;
  unsignedHash?: string;
}
export type StepResult = { ok: true } | { ok: false; error: string };
export interface Step {
  name: StepName;
  run(ctx: Context): Promise<StepResult>;
}
export function diagnostic(error: unknown): string {
  return (error instanceof Error ? error.message : "Engine packaging failed")
    .replaceAll(homedir(), "<home>")
    .replace(/\p{Cc}/gu, " ")
    .slice(0, 512);
}
export function step(name: StepName, run: (ctx: Context) => Promise<void> | void): Step {
  return {
    name,
    async run(ctx) {
      try {
        await run(ctx);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: `${name}: ${diagnostic(error)}` };
      }
    },
  };
}
export async function runSteps(ctx: Context, steps: readonly Step[]): Promise<void> {
  for (const item of steps) {
    const result = await item.run(ctx);
    if (!result.ok) {
      throw new Error(result.error);
    }
  }
}
