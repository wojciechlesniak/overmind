import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, relative, isAbsolute, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePinnedAsset, readBinaryLock, type PinnedAsset } from "./lock.parse-boundary.ts";

const root = resolve(import.meta.dirname, "../..");
function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function verifyChecksum(bytes: Uint8Array, expected: string): void {
  if (!/^[a-f0-9]{64}$/u.test(expected) || hash(bytes) !== expected) {
    throw new Error("Binary checksum mismatch");
  }
}
async function download(url: string): Promise<Uint8Array> {
  let target = new URL(url);
  for (let hop = 0; hop < 6; hop++) {
    if (target.protocol !== "https:" || target.username || target.password) {
      throw new Error("Unsafe binary download URL");
    }
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new Error("Binary redirect has no target");
      }
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Binary download failed: HTTP ${String(response.status)}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Binary download has no body");
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        length += chunk.value.byteLength;
        if (length > 128 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Binary archive exceeds limit");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks, length);
  }
  throw new Error("Too many binary download redirects");
}
function confinedDirectory(path: string): string {
  const distance = relative(root, path);
  if (distance.startsWith("..") || isAbsolute(distance)) {
    throw new Error("Binary cache escapes repository");
  }
  let current = realpathSync(root);
  for (const component of distance.split(sep)) {
    current = resolve(current, component);
    if (existsSync(current)) {
      const info = lstatSync(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error("Binary cache must use real directories");
      }
    } else {
      mkdirSync(current, { mode: 0o700 });
    }
  }
  return current;
}
function checkCacheFile(path: string): void {
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (info) {
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
      throw new Error("Cached binary files must be regular and unlinked");
    }
  }
}

function writeAtomic(destination: string, bytes: Uint8Array, mode: number): void {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, bytes, { flag: "wx", mode });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export async function installResource(
  name: string,
  value: PinnedAsset,
  options: { offline?: boolean; fetchBytes?: (url: string) => Promise<Uint8Array> } = {},
): Promise<string | undefined> {
  if (!/^[a-z][a-z0-9-]*$/u.test(name)) {
    throw new Error("Invalid pinned resource name");
  }
  const asset = parsePinnedAsset(value);
  const directory = confinedDirectory(resolve(root, ".cache/tools", `${name}-${asset.sha256}`));
  const destination = resolve(directory, "resource");
  checkCacheFile(destination);
  if (!existsSync(destination)) {
    if (options.offline) {
      return undefined;
    }
    const bytes = await (options.fetchBytes ?? download)(asset.url);
    verifyChecksum(bytes, asset.sha256);
    writeAtomic(destination, bytes, 0o600);
  }
  verifyChecksum(readFileSync(destination), asset.sha256);
  return destination;
}

export async function install(
  name: string,
  options: {
    lockFile?: string;
    platform?: string;
    fetchBytes?: (url: string) => Promise<Uint8Array>;
  } = {},
): Promise<string> {
  const entry = readBinaryLock(
    options.lockFile ?? resolve(import.meta.dirname, "lock.json"),
    name,
  ).find((item) => item.name === name);
  if (!entry) {
    throw new Error(`Unknown pinned binary: ${name}`);
  }
  const platform = options.platform ?? `${process.platform}-${process.arch}`;
  const asset = Object.hasOwn(entry.assets, platform) ? entry.assets[platform] : undefined;
  if (!asset) {
    throw new Error(`Unsupported platform for ${name}: ${platform}`);
  }
  const directory = confinedDirectory(
    resolve(root, ".cache/tools", `${name}-${entry.version}-${asset.sha256}`),
  );
  const archive = resolve(directory, "archive.tar.gz");
  checkCacheFile(archive);
  if (!existsSync(archive)) {
    const bytes = await (options.fetchBytes ?? download)(asset.url);
    verifyChecksum(bytes, asset.sha256);
    writeAtomic(archive, bytes, 0o600);
  }
  verifyChecksum(readFileSync(archive), asset.sha256);
  // Extract only the selected member to stdout: archive paths never touch the filesystem.
  const members = execFileSync("tar", ["-tzf", archive], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
    .trim()
    .split("\n");
  const matches = members.filter(
    (member) =>
      basename(member) === name && !isAbsolute(member) && !member.split("/").includes(".."),
  );
  if (matches.length !== 1) {
    throw new Error("Archive must contain exactly one expected binary");
  }
  const member = matches[0];
  if (!member) {
    throw new Error("Expected binary is missing");
  }
  const binary = execFileSync("tar", ["-xOzf", archive, "--", member], {
    maxBuffer: 128 * 1024 * 1024,
  });
  if (!binary.length) {
    throw new Error("Archive binary is empty");
  }
  const destination = resolve(directory, name);
  checkCacheFile(destination);
  if (!existsSync(destination) || hash(readFileSync(destination)) !== hash(binary)) {
    writeAtomic(destination, binary, 0o700);
  }
  chmodSync(destination, 0o700);
  return destination;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];
  if (!name) {
    throw new Error("Usage: tsx tools/pinned-bin/install.ts <name>");
  }
  console.log(await install(name));
}
