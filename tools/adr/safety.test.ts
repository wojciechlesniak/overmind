import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { Files } from "./files.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
// OVE_OSS006: supported macOS/Linux hosts provide POSIX named pipes and links.
test.skipIf(process.platform === "win32")(
  "public ADR checking refuses FIFO and indirect inputs without hanging",
  () => {
    const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-safe-")));
    try {
      mkdirSync(resolve(root, "docs/adr"), { recursive: true });
      mkdirSync(resolve(root, "tasks"));
      copyFileSync(
        resolve(sourceRoot, "docs/adr/slug-map.json"),
        resolve(root, "docs/adr/slug-map.json"),
      );
      const path = resolve(root, "docs/adr/0001-single-chief-as-sole-interlocutor.md");
      const run = () =>
        spawnSync(
          process.execPath,
          ["--import", import.meta.resolve("tsx"), resolve(sourceRoot, "tools/adr/check.ts")],
          { cwd: root, encoding: "utf8", timeout: 3000 },
        );
      execFileSync("mkfifo", [path], { timeout: 3000 });
      const pipe = run();
      expect(pipe.error).toBeUndefined();
      expect(pipe.status).toBe(1);
      expect(pipe.stderr).toContain("Invalid ADR metadata or filename");
      rmSync(path);
      writeFileSync(resolve(root, "outside.md"), "outside marker");
      symlinkSync(resolve(root, "outside.md"), path);
      const linked = run();
      expect(linked.status).toBe(1);
      expect(linked.stderr).toContain("ADR paths must be real");
      expect(linked.stderr).not.toContain("outside marker");
      const files = new Files(root);
      expect(() => files.read("../outside.md")).toThrow("escapes repository");
      rmSync(path);
      writeFileSync(path, "x".repeat(2 * 1024 * 1024 + 1));
      expect(() => files.read(path)).toThrow("bounded regular file");
      expect(() => files.read("docs/adr")).toThrow("bounded regular file");
      writeFileSync(path, Buffer.from([0xff, 0xfe]));
      expect(() => files.read(path)).toThrow();
      writeFileSync(resolve(root, "docs/adr/.adr-tool.lock"), "another owner\n");
      expect(() => files.locked(() => "unreachable")).toThrow();
      expect(() => {
        files.write(path, "replacement");
      }).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
