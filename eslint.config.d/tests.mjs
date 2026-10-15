import noFocusedTests from "../tools/eslint/no-focused-tests.mjs";
export default [
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    plugins: { overmind: { rules: { "no-focused-tests": noFocusedTests } } },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "overmind/no-focused-tests": "error",
    },
  },
];
