import { diagnostic, missingHook, stderr } from "../cli.ts";
import { EXIT_CODES } from "../exit-codes.ts";

export interface RunOptions {
  dataDir?: string;
  foreground: boolean;
}
interface EngineHooks {
  startEngine: (options: RunOptions) => Promise<never>;
  shutdown: () => Promise<void>;
}

export function installShutdown(shutdown: () => Promise<void>): () => void {
  let stopping = false;
  let deadline: NodeJS.Timeout | undefined;
  const signal = () => {
    if (stopping) {
      process.exit(130);
    }
    stopping = true;
    deadline = setTimeout(() => {
      process.exit(EXIT_CODES.ok);
    }, 5000);
    void Promise.resolve()
      .then(shutdown)
      .catch((error: unknown) => {
        stderr(`${diagnostic(error)}\n`);
      })
      .finally(() => {
        process.exit(EXIT_CODES.ok);
      });
  };
  process.on("SIGTERM", signal);
  process.on("SIGINT", signal);
  return () => {
    process.off("SIGTERM", signal);
    process.off("SIGINT", signal);
    clearTimeout(deadline);
  };
}

async function loadEngine(): Promise<unknown> {
  try {
    // @ts-expect-error -- ENGINE/ARCH006 owns this future module; replace with static import when it lands.
    return await import("../compose/index.js");
  } catch (error) {
    if (missingHook(error, "/compose/index.js")) {
      return undefined;
    }
    throw error;
  }
}
export async function run(options: RunOptions, load = loadEngine): Promise<number> {
  const hooks = await load();
  if (hooks === undefined) {
    stderr("engine bootstrap not implemented\n");
    return EXIT_CODES.cannotStart;
  }
  if (
    typeof hooks !== "object" ||
    hooks === null ||
    !("startEngine" in hooks) ||
    typeof hooks.startEngine !== "function" ||
    !("shutdown" in hooks) ||
    typeof hooks.shutdown !== "function"
  ) {
    throw new Error("invalid engine composition hook");
  }
  const engine = hooks as EngineHooks;
  const removeHandlers = installShutdown(() => engine.shutdown());
  try {
    await engine.startEngine(options);
    throw new Error("engine start returned unexpectedly");
  } finally {
    removeHandlers();
  }
}
