import { resolve } from "node:path";

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
  environment: "node" | "happy-dom";
}) {
  return {
    root: options.root,
    test: {
      name: options.name,
      environment: options.environment,
      environmentOptions: {
        happyDOM: {
          settings: {
            enableJavaScriptEvaluation: false,
            disableJavaScriptFileLoading: true,
            enableCSSFileLoading: false,
            enableImageFileLoading: false,
            enableIframePageLoading: false,
            enableFileSystemHttpRequests: false,
          },
        },
      },
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
