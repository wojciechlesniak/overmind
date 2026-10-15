import { readdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import prettier from "eslint-config-prettier";

const root = realpathSync(import.meta.dirname);
function requireInsideRoot(path) {
  const resolved = realpathSync(path);
  const difference = relative(root, resolved);
  if (difference.startsWith("..") || isAbsolute(difference)) {
    throw new Error(`ESLint configuration escapes the repository: ${path}`);
  }
  return resolved;
}
const directory = requireInsideRoot(resolve(root, "eslint.config.d"));
const modules = [];
for (const entry of readdirSync(directory)
  .filter((name) => name.endsWith(".mjs"))
  .sort()) {
  const file = requireInsideRoot(resolve(directory, entry));
  const module = await import(pathToFileURL(file).href);
  if (!Array.isArray(module.default)) {
    throw new Error(`Config must export an array: ${entry}`);
  }
  modules.push(...module.default);
}
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.tsbuild/**",
      "**/dist/**",
      "**/coverage/**",
      "**/storybook-static/**",
      "apps/desktop/src-tauri/target/**",
      "apps/desktop/src-tauri/binaries/**",
      "pnpm-lock.yaml",
      "tasks/**",
      "docs/**",
      "**/*.generated.ts",
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  ...modules,
  { ...prettier, rules: { ...prettier.rules, curly: ["error", "all"] } },
];
