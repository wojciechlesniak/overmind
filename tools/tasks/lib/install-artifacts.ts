import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import { join } from "node:path";
import { gitText } from "./git.ts";
import type { Git } from "./git.ts";

// Receipts remain in memory for this invocation. Exceeding either bound retains
// the worktree rather than guessing which files belong to the installation.
const maxEntries = 100_000;
const maxBytes = 512 * 1024 * 1024;

export interface InstallArtifacts {
  readonly fingerprint: string;
}

function metadata(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.mode, stat.size, stat.nlink, stat.mtimeNs, stat.ctimeNs].join(
    ":",
  );
}

async function fingerprint(git: Git, root: string): Promise<string> {
  const ignored = (
    await gitText(
      git,
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "--directory",
      "-z",
    )
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const roots = new Set<string>();
  for (const entry of ignored) {
    const parts = entry.replace(/\/$/u, "").split("/");
    const node = parts.indexOf("node_modules");
    if (node < 0 || parts.some((part) => !part || part === "." || part === "..")) {
      throw new Error("Ignored data is outside installation roots");
    }
    roots.add(parts.slice(0, node + 1).join("/"));
  }
  const rootStat = lstatSync(root, { bigint: true });
  if (!rootStat.isDirectory() || realpathSync(root) !== root) {
    throw new Error("Installation root is not canonical");
  }
  const hash = createHash("sha256");
  hash.update(JSON.stringify(ignored));
  let entries = 0;
  let bytes = 0;
  function visit(relative: string): void {
    entries += 1;
    if (entries > maxEntries) {
      throw new Error("Installation inventory exceeds its entry bound");
    }
    const path = join(root, relative);
    const before = lstatSync(path, { bigint: true });
    if (before.dev !== rootStat.dev) {
      throw new Error("Installation inventory crosses a mount");
    }
    hash.update(JSON.stringify([relative, metadata(before)]));
    if (before.isSymbolicLink()) {
      hash.update(JSON.stringify(readlinkSync(path)));
    } else if (before.isDirectory()) {
      if (realpathSync(path) !== path) {
        throw new Error("Installation inventory contains an indirect directory");
      }
      for (const name of readdirSync(path).sort()) {
        visit(relative + "/" + name);
      }
    } else if (before.isFile()) {
      bytes += Number(before.size);
      if (bytes > maxBytes) {
        throw new Error("Installation inventory exceeds its byte bound");
      }
      const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (metadata(fstatSync(descriptor, { bigint: true })) !== metadata(before)) {
          throw new Error("Installation file changed during inventory");
        }
        const buffer = Buffer.alloc(64 * 1024);
        let read = 0;
        let total = 0;
        while ((read = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
          total += read;
          if (total > Number(before.size)) {
            throw new Error("Installation file grew during inventory");
          }
          hash.update(buffer.subarray(0, read));
        }
        if (total !== Number(before.size)) {
          throw new Error("Installation file shrank during inventory");
        }
        if (metadata(fstatSync(descriptor, { bigint: true })) !== metadata(before)) {
          throw new Error("Installation file changed during inventory");
        }
      } finally {
        closeSync(descriptor);
      }
    } else {
      throw new Error("Installation inventory contains an unsupported file");
    }
    if (metadata(lstatSync(path, { bigint: true })) !== metadata(before)) {
      throw new Error("Installation artifact changed during inventory");
    }
  }
  for (const relative of [...roots].sort()) {
    const parts = relative.split("/");
    for (let count = 1; count <= parts.length; count += 1) {
      const path = join(root, ...parts.slice(0, count));
      const stat = lstatSync(path, { bigint: true });
      if (!stat.isDirectory() || stat.dev !== rootStat.dev || realpathSync(path) !== path) {
        throw new Error("Installation directory is not canonical");
      }
    }
    visit(relative);
  }
  return hash.digest("hex");
}

export async function captureInstallArtifacts(
  git: Git,
  root: string,
): Promise<InstallArtifacts | undefined> {
  try {
    return { fingerprint: await fingerprint(git, root) };
  } catch {
    // A successful claim can continue; only automatic cleanup needs this proof.
    return undefined;
  }
}

export async function unchangedInstallArtifacts(
  git: Git,
  root: string,
  receipt: InstallArtifacts | undefined,
): Promise<boolean> {
  if (!receipt) {
    return false;
  }
  try {
    return (await fingerprint(git, root)) === receipt.fingerprint;
  } catch {
    return false;
  }
}
