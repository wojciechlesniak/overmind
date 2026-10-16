// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const desktop = resolve(import.meta.dirname, "..");
function run(directory: string) {
  return spawnSync(process.execPath, [resolve(desktop, "scripts/check-dist.mjs"), directory], {
    encoding: "utf8",
    timeout: 10000,
  });
}
it.each([
  ['<main>Overmind</main><script src="/assets/app.js"></script>', true],
  ["eval('danger')", false],
  ['<script data-src="/assets/app.js">alert(1)</script>', false],
  ['<script title=" src=/assets/app.js">alert(1)</script>', false],
  ['<script src="//example.invalid/app.js"></script>', false],

  ["new Function('danger')", false],
  ["https://example.invalid/remote.js", false],
  ["<script>alert('danger')</script>", false],
  ["fonts.googleapis.com", false],
  ["<style>body{display:none}</style>", false],
  ["//# sourceMappingURL=app.js.map", false],
  ["http://www.w3.org/2000/svg", true],
])("actual dist CLI checks fixture %#", (source, allowed) => {
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-dist-"));
  try {
    writeFileSync(resolve(directory, "index.html"), source);
    const result = run(directory);
    expect(result.status).toBe(allowed ? 0 : 1);
    if (allowed) {
      expect(result.stdout).toContain("File\tBytes");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it("literal React exceptions do not hide executable script bodies or other URLs", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-dist-"));
  try {
    mkdirSync(resolve(directory, "assets"));
    writeFileSync(resolve(directory, "index.html"), "<main>Overmind</main>");
    for (const source of [
      '"https://react.dev/errors/evil"',
      'fetch("https://react.dev/errors/")',
      'import("https://react.dev/errors/")',
      'fetch("HTTPS://example.invalid/")',

      'n.innerHTML="<script>alert(1)</script>"',
      '"https://react.dev/errors/";fetch("https://example.invalid/")',
    ]) {
      writeFileSync(resolve(directory, "assets/index-probe.js"), source);
      expect(run(directory).status).toBe(1);
    }
    symlinkSync("index-probe.js", resolve(directory, "assets/link.js"));
    expect(run(directory).status).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it("source HTML has exactly one local module script and no inline, base or remote content", () => {
  const html = readFileSync(resolve(desktop, "index.html"), "utf8");
  expect(html.match(/<script\b/gu)).toHaveLength(1);
  expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
  expect(html).not.toMatch(/https?:\/\/|<base\b|<style\b|\sstyle\s*=/iu);
  expect(html).toContain('lang="en"');
});
