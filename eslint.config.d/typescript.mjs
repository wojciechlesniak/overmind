import tseslint from "typescript-eslint";
import { resolve } from "node:path";

const files = ["**/*.ts", "**/*.tsx"];
// Tests load before this module alphabetically. Preserve their deliberate
// non-null relaxation by applying the strict non-null rule to source only.
const presets = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => {
  const rules = { ...config.rules };
  delete rules["@typescript-eslint/no-non-null-assertion"];
  return { ...config, files, rules };
});
export default [
  ...presets,
  {
    files,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: resolve(import.meta.dirname, "..") },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/only-throw-error": "error",
    },
  },
  {
    files,
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "error" },
  },
  {
    files,
    ignores: ["**/*.parse-boundary.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        "WithStatement",
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Parse untrusted JSON through a zod schema",
        },
      ],
    },
  },
  {
    files: ["**/fixtures/**/*.ts", "**/fixtures/**/*.tsx"],
    rules: Object.fromEntries(
      Object.keys(tseslint.plugin.rules)
        .filter((name) => name.startsWith("no-unsafe-"))
        .map((name) => [`@typescript-eslint/${name}`, "off"]),
    ),
  },
];
