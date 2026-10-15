import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";
// Individual shards collect partial coverage. The merge job uses the original
// root config and enforces every unchanged package threshold on the full suite.
const coverage = { ...base.test?.coverage };
delete coverage.thresholds;
export default defineConfig({
  ...base,
  test: { ...base.test, coverage },
});
