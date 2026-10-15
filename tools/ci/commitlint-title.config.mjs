import base from "../../commitlint.config.mjs";
// A PR title has no body or task footer. Reuse every header/scope rule without
// relaxing the configuration used for actual commits.
export default {
  ...base,
  rules: {
    ...base.rules,
    "commit-policy": [2, "always", { titleOnly: true }],
    "task-reference": [0],
  },
};
