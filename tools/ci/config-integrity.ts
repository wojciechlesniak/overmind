import { execFileSync } from "node:child_process";
import { readEvent } from "./context.parse-boundary.ts";
const pr = readEvent().pull_request;
if (pr) {
  const files = execFileSync("git", ["diff", "--name-only", "-z", pr.base.sha, pr.head.sha], {
    encoding: "utf8",
  }).split("\0");
  const protectedFiles = files.filter(
    (file) =>
      file === ".markdownlint-cli2.jsonc" ||
      /^(?:(?:AGENTS|CLAUDE)\.md|lefthook(?:-secrets)?\.yml|commitlint\.config\.mjs|eslint\.config[^/]*(?:\/.*)?|\.oxlintrc\.json|vitest(?:\.shared|\.ci\.config)\.ts|\.github\/actionlint\.yaml|\.github\/workflows\/.*|\.github\/actions\/.*|apps\/desktop\/(?:vite\.config\.ts|scripts\/(?:check-dist[^/]*\.(?:mjs|json)|check-tauri-config\.mjs|tauri-permission-allowlist\.json)|src-tauri\/.*)|third-party\/rust\/.*|rust-toolchain\.toml|renovate\.json|docs\/dependencies\.md|deny\.toml|\.gitleaks\.toml|tools\/secret-scan\/safe-sarif\.tmpl|tools\/secret-scan\/(?:policy|gitleaks\.lock|syft\.lock|default-config\.lock)\.json|tools\/pinned-bin\/lock\.json|tools\/(?:build|vite|vitest-projects)\/.*|tools\/package-engine\/.*|tools\/check-licenses\/.*|tools\/commitlint\/.*|tools\/errors\/.*|tools\/adr\/.*|docs\/adr\/(?:slug-map\.json|_template\.md))$/u.test(
        file,
      ),
  );
  const labels = new Set(pr.labels.map((label) => label.name));
  // Requiring approval for every ESLint configuration edit also covers severity
  // downgrades without attempting to interpret executable configuration diffs.
  if (
    files.some(
      (file) => /^eslint\.config[^/]*(?:\/.*)?$/u.test(file) || file === ".oxlintrc.json",
    ) &&
    !labels.has("lint-config-change")
  ) {
    throw new Error("ESLint configuration changes also require lint-config-change");
  }
  if (protectedFiles.length && !labels.has("config-change")) {
    throw new Error(
      `Protected configuration changes require config-change: ${protectedFiles.join(", ")}`,
    );
  }
  if (
    files.some(
      (file) =>
        file === "lefthook.yml" ||
        file === "lefthook-secrets.yml" ||
        file === "commitlint.config.mjs",
    ) &&
    !labels.has("hooks-change")
  ) {
    throw new Error("Hook configuration changes also require hooks-change");
  }
}
