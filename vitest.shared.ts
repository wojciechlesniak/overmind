import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

export const coverageThresholds = {
  core: { lines: 90, functions: 90, branches: 85, statements: 90 },
  infrastructure: { lines: 80, functions: 80, branches: 75, statements: 80 },
  ui: { lines: 70, functions: 70, branches: 65, statements: 70 },
  tools: { lines: 70, functions: 70, branches: 60, statements: 70 },
} as const;
const root = import.meta.dirname;
export function sharedConfig(options: {
  name: string;
  root: string;
  environment: "node" | "jsdom";
}) {
  return {
    root: options.root,
    test: {
      name: options.name,
      environment: options.environment,
      include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
      exclude: ["**/*.int.test.ts"],
      globals: false,
      restoreMocks: true,
      clearMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      testTimeout: 5000,
      hookTimeout: 10000,
      pool: "forks" as const,
      passWithNoTests: false,
      retry: 0,
      setupFiles: [resolve(root, "tools/vitest-setup/setup-node.ts")],
      env: { TZ: "UTC", LANG: "C.UTF-8" },
    },
  };
}
export async function packageCoverage() {
  const directories = ["apps", "packages", "packages/adapters"].flatMap((parent) =>
    readdirSync(resolve(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(root, parent, entry.name)),
  );
  directories.push(resolve(root, "tools"));
  const thresholds: Record<
    string,
    { lines: number; functions: number; branches: number; statements: number }
  > = {};
  for (const directory of directories) {
    const configFile = resolve(directory, "vitest.config.ts");
    if (!existsSync(configFile)) {
      continue;
    }
    const file = realpathSync(configFile);
    const distance = relative(realpathSync(root), file);
    if (distance.startsWith("..") || isAbsolute(distance)) {
      throw new Error("Test configuration escapes repository");
    }
    const namespace: unknown = await import(pathToFileURL(file).href);
    const metadata = z
      .object({
        coverageThreshold: z.object({
          lines: z.number(),
          functions: z.number(),
          branches: z.number(),
          statements: z.number(),
        }),
      })
      .parse(namespace);
    thresholds[`${relative(root, dirname(file))}/src/**`] = metadata.coverageThreshold;
  }
  return {
    provider: "v8" as const,
    reporter: ["text-summary", "lcov", "json-summary"] as ["text-summary", "lcov", "json-summary"],
    reportsDirectory: resolve(root, "coverage"),
    include: ["**/src/**/*.{ts,tsx}"],
    exclude: [
      "**/*.test.*",
      "**/*.stories.*",
      "**/fixtures/**",
      "**/*.generated.ts",
      "**/index.ts",
      "**/src-tauri/**",
    ],
    thresholds,
  };
}
