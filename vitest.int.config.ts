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
export default defineConfig(config);
