import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  linkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { install, installResource, verifyChecksum } from "./install.ts";
import { readBinaryLock } from "./lock.parse-boundary.ts";
const root = resolve(import.meta.dirname, "../..");
it("rejects checksum changes, unknown names, unsafe URLs and duplicate pins", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(() => {
    verifyChecksum(bytes, "0".repeat(64));
  }).toThrow("checksum mismatch");
  await expect(install("../../escape")).rejects.toThrow("Unknown");
  const fixture = mkdtempSync(join(tmpdir(), "overmind-binary-lock-"));
  try {
    const file = join(fixture, "lock.json");
    const pin = {
      name: "fixture",
      version: "1.0.0",
      assets: { "linux-x64": { url: "https://example.com/tool", sha256: "0".repeat(64) } },
    };
    writeFileSync(file, JSON.stringify([pin, pin]));
    expect(() => readBinaryLock(file)).toThrow("Duplicate");
    await expect(install("actionlint", { platform: "__proto__" })).rejects.toThrow(
      "Unsupported platform",
    );
    for (const url of ["http://example.com/tool", "https://user:password@example.com/tool"]) {
      writeFileSync(
        file,
        JSON.stringify([
          {
            name: "fixture",
            version: "1.0.0",
            assets: { "linux-x64": { url, sha256: "0".repeat(64) } },
          },
        ]),
      );
      expect(() => readBinaryLock(file)).toThrow();
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
it("verifies archives and cached content before returning an executable path", async () => {
  const fixture = mkdtempSync(join(tmpdir(), "overmind-binary-"));
  let cache: string | undefined;
  try {
    mkdirSync(join(fixture, "package"));
    writeFileSync(join(fixture, "package/fixture"), "verified fixture bytes");
    execFileSync("tar", [
      "-czf",
      join(fixture, "archive.tgz"),
      "-C",
      join(fixture, "package"),
      "fixture",
    ]);
    const bytes = readFileSync(join(fixture, "archive.tgz"));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    cache = resolve(root, ".cache/tools", `fixture-1.0.0-${sha256}`);
    const lockFile = join(fixture, "lock.json");
    writeFileSync(
      lockFile,
      JSON.stringify([
        {
          name: "fixture",
          version: "1.0.0",
          assets: { "fixture-platform": { url: "https://example.com/fixture.tgz", sha256 } },
        },
      ]),
    );
    const options = {
      lockFile,
      platform: "fixture-platform",
      fetchBytes: () => Promise.resolve(bytes),
    };
    const binary = await install("fixture", options);
    expect(readFileSync(binary, "utf8")).toBe("verified fixture bytes");
    writeFileSync(binary, "tampered executable");
    expect(readFileSync(await install("fixture", options), "utf8")).toBe("verified fixture bytes");
    rmSync(binary);
    linkSync(join(fixture, "package/fixture"), binary);
    await expect(install("fixture", options)).rejects.toThrow("regular and unlinked");
    rmSync(binary);
    await install("fixture", options);
    rmSync(resolve(cache, "archive.tar.gz"));
    symlinkSync(join(fixture, "archive.tgz"), resolve(cache, "archive.tar.gz"));
    await expect(install("fixture", options)).rejects.toThrow("regular and unlinked");
    rmSync(resolve(cache, "archive.tar.gz"));
    writeFileSync(resolve(cache, "archive.tar.gz"), "tampered archive");
    await expect(install("fixture", options)).rejects.toThrow("checksum mismatch");
    rmSync(cache, { recursive: true, force: true });
    symlinkSync(fixture, cache, "dir");
    await expect(install("fixture", options)).rejects.toThrow("real directories");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    if (cache) {
      rmSync(cache, { recursive: true, force: true });
    }
  }
});

it("supports a named caller's separate lockfile without duplicating the downloader", () => {
  const directory = mkdtempSync(join(tmpdir(), "overmind-single-lock-"));
  try {
    const path = join(directory, "lock.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: "1.0.0",
        assets: { "linux-x64": { url: "https://example.com/tool.tar.gz", sha256: "0".repeat(64) } },
      }),
    );
    expect(readBinaryLock(path, "fixture")[0]?.name).toBe("fixture");
    expect(() => readBinaryLock(path, "../escape")).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("refuses HTTPS downgrade redirects and failed downloads before caching bytes", async () => {
  const fixture = mkdtempSync(join(tmpdir(), "overmind-redirect-"));
  const cache = resolve(root, ".cache/tools", `fixture-redirect-1.0.0-${"0".repeat(64)}`);
  try {
    const lockFile = join(fixture, "lock.json");
    writeFileSync(
      lockFile,
      JSON.stringify([
        {
          name: "fixture-redirect",
          version: "1.0.0",
          assets: { test: { url: "https://example.com/tool", sha256: "0".repeat(64) } },
        },
      ]),
    );
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: "http://example.com/unsafe" } }),
      ),
    );
    await expect(install("fixture-redirect", { lockFile, platform: "test" })).rejects.toThrow(
      "Unsafe binary download URL",
    );
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 503 })));
    await expect(install("fixture-redirect", { lockFile, platform: "test" })).rejects.toThrow(
      "HTTP 503",
    );
  } finally {
    vi.unstubAllGlobals();
    rmSync(fixture, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
});

it("pinned data resources reject corrupt downloads, cache tampering and symlinks without an offline fallback", async () => {
  const bytes = Buffer.from("pinned default configuration fixture");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = { url: "https://example.invalid/config", sha256 };
  const cache = resolve(root, ".cache/tools", `resource-fixture-${sha256}`);
  const destination = resolve(cache, "resource");
  try {
    expect(await installResource("resource-fixture", asset, { offline: true })).toBeUndefined();
    await expect(
      installResource("resource-fixture", asset, {
        fetchBytes: () => Promise.resolve(Buffer.from("corrupt")),
      }),
    ).rejects.toThrow("checksum mismatch");
    expect(
      await installResource("resource-fixture", asset, {
        fetchBytes: () => Promise.resolve(bytes),
      }),
    ).toBe(destination);
    expect(await installResource("resource-fixture", asset, { offline: true })).toBe(destination);
    writeFileSync(destination, "tampered");
    await expect(installResource("resource-fixture", asset, { offline: true })).rejects.toThrow(
      "checksum mismatch",
    );
    rmSync(destination);
    symlinkSync("/dev/null", destination);
    await expect(installResource("resource-fixture", asset, { offline: true })).rejects.toThrow(
      "regular",
    );
    await expect(installResource("../escape", asset)).rejects.toThrow("name");
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});
