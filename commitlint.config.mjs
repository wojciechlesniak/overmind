import plugin, { areaScopes, currentBranch } from "./tools/commitlint/plugin.mjs";

const branch = currentBranch();
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [plugin],
  defaultIgnores: true,
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "test",
        "refactor",
        "perf",
        "build",
        "ci",
        "chore",
        "revert",
        "security",
      ],
    ],
    "scope-enum": [2, "always", areaScopes()],
    "scope-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
    "subject-case": [0],
    "subject-full-stop": [2, "never", "."],
    "body-max-line-length": [2, "always", 100],
    "footer-max-line-length": [2, "always", 100],
    "task-reference": [/^task\/OVE_[A-Z]{2,6}\d{3}$/u.test(branch) ? 2 : 1, "always", branch],
    "commit-policy": [2, "always"],
  },
};
