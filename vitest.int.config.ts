import { defineConfig } from "vitest/config";
import { sharedConfig } from "./vitest.shared.ts";
const config = sharedConfig({
  name: "overmind-int",
  root: import.meta.dirname,
  environment: "node",
});
config.test.include = [
  "apps/**/*.int.test.ts",
  "packages/**/*.int.test.ts",
  "tools/**/*.int.test.ts",
];
config.test.exclude = ["**/node_modules/**", "**/.tsbuild/**"];
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    // Integration files launch real compilers, Git clients and engine processes.
    // Match the unit suite's bounded workers rather than oversubscribe the host.
    maxWorkers: 2,
  },
});
