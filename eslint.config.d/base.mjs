import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "no-throw-literal": "error",
      "prefer-const": "error",
      "no-var": "error",
      "no-restricted-globals": ["error", "event"],
      "no-restricted-syntax": ["error", "WithStatement"],
      curly: ["error", "all"],
    },
  },
  {
    files: [
      "*.mjs",
      "eslint.config.d/*.mjs",
      "tools/**",
      "apps/engine/**",
      "packages/gateway/**",
      "packages/adapters/**",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["tools/**", "**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    rules: { "no-console": "off" },
  },
];
