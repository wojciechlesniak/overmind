// Tests have Node/DOM typings; production packages keep their own strict types.
export default [
  {
    files: [
      "vitest*.ts",
      "**/vitest.config.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "tools/vitest-projects/discovery.ts",
      "tools/vitest-projects/coverage.ts",
    ],
    languageOptions: { parserOptions: { projectService: false, project: "./tsconfig.tests.json" } },
  },
];
