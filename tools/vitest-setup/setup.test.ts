import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { it, expect } from "vitest";
import { allowLocalhost } from "./setup-node.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const cli = resolve(require.resolve("vitest/package.json"), "../vitest.mjs");

it("blocks internet and localhost by default", () => {
  expect(() => fetch("https://example.com")).toThrow("Network access is forbidden");
  expect(() => fetch("http://127.0.0.1:12345")).toThrow("Network access is forbidden");
});
it("permits explicit loopback requests but forbids external hosts and redirects", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "https://example.com" });
    }
    response.end("local fixture");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    allowLocalhost();
    expect(await (await fetch(`http://127.0.0.1:${String(address.port)}/`)).text()).toBe(
      "local fixture",
    );
    expect(() => fetch("https://example.com")).toThrow("Network access is forbidden");
    expect(() => fetch("http://localhost.example.com")).toThrow("Network access is forbidden");
    await expect(
      fetch(`http://127.0.0.1:${String(address.port)}/redirect`, { redirect: "follow" }),
    ).rejects.toThrow();
  } finally {
    await new Promise<void>((done, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          done();
        }
      });
    });
  }
});
it("resets localhost permission before the next test", () => {
  expect(() => fetch("http://127.0.0.1:12345")).toThrow("Network access is forbidden");
});

function withProbe(path: string, source: string, check: () => void): void {
  const file = resolve(root, path);
  assert.equal(existsSync(file), false);
  writeFileSync(file, source);
  try {
    check();
  } finally {
    unlinkSync(file);
  }
}
it("an unhandled rejection fails a real Vitest subprocess", { timeout: 30_000 }, () => {
  withProbe(
    "packages/domain/src/__ove004_rejection__.test.ts",
    'import { it } from "vitest"; it("rejects", () => { void Promise.reject(new Error("OVE004_UNHANDLED")); });\n',
    () => {
      const result = spawnSync(
        process.execPath,
        [cli, "run", "--project", "domain", "--reporter=dot"],
        { cwd: root, encoding: "utf8", timeout: 25_000 },
      );
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /OVE004_UNHANDLED/);
    },
  );
});
it("an unimported domain function fails its own coverage threshold", { timeout: 30_000 }, () => {
  const report = mkdtempSync(join(tmpdir(), "overmind-coverage-probe-"));
  try {
    withProbe(
      "packages/domain/src/__ove004_uncovered__.ts",
      "export function uncovered(value: boolean): number { if (value) return 1; return 0; }\n",
      () => {
        withProbe(
          "packages/domain/src/__ove004_coverage_canary__.test.ts",
          'import { it } from "vitest"; it("OVE004_COVERAGE_CANARY", () => {});\n',
          () => {
            const result = spawnSync(
              process.execPath,
              [
                cli,
                "run",
                "--project",
                "domain",
                "packages/domain/src/__ove004_coverage_canary__.test.ts",
                "--coverage",
                "--coverage.reportsDirectory",
                report,
                "--reporter=dot",
              ],
              { cwd: root, encoding: "utf8", timeout: 25_000 },
            );
            assert.equal(result.error, undefined);
            assert.notEqual(result.status, 0);
            assert.match(result.stdout + result.stderr, /coverage.*threshold|threshold.*coverage/i);
            assert.match(result.stdout + result.stderr, /packages\/domain\/src/);
          },
        );
      },
    );
  } finally {
    rmSync(report, { recursive: true, force: true });
  }
});

it("blocks fetch during test-module import", { timeout: 30_000 }, () => {
  withProbe(
    "packages/domain/src/__ove004_import_network__.test.ts",
    'import { it } from "vitest"; await fetch("https://example.com"); it("unreachable", () => {});\n',
    () => {
      const result = spawnSync(
        process.execPath,
        [cli, "run", "--project", "domain", "--reporter=dot"],
        { cwd: root, encoding: "utf8", timeout: 25_000 },
      );
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /Network access is forbidden/);
    },
  );
});
