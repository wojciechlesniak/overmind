import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function safeDirectory(root: string, path: string, create = false): string {
  root = realpathSync(root);
  const distance = relative(root, resolve(path));
  if (distance === ".." || distance.startsWith(`..${sep}`) || isAbsolute(distance)) {
    throw new Error("Packaging path escapes repository");
  }
  let current = root;
  const device = lstatSync(root).dev;
  for (const part of distance.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (!existsSync(current) && create) {
      mkdirSync(current, { mode: 0o700 });
    }
    const info = lstatSync(current);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.dev !== device ||
      info.uid !== process.getuid?.()
    ) {
      throw new Error("Packaging directory must be real, owned and on the repository volume");
    }
  }
  return current;
}
export function safeFile(
  root: string,
  path: string,
  missing = false,
  maxBytes = 150000000,
): string {
  safeDirectory(root, dirname(path));
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (!info && missing) {
    return path;
  }
  if (
    !info?.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.uid !== process.getuid?.()
  ) {
    throw new Error("Packaging file must be regular, owned and unlinked");
  }
  if (info.size > maxBytes) {
    throw new Error("Packaging file exceeds its size limit");
  }
  return path;
}
export function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
export function acquireOutputLock(root: string, out: string): () => void {
  safeDirectory(root, out);
  const path = resolve(out, ".overmind-engine.lock");
  let descriptor: number;
  try {
    descriptor = openSync(path, "wx", 0o600);
  } catch {
    throw new Error("Packaging output is already locked or unavailable");
  }
  const owned = fstatSync(descriptor);
  writeFileSync(descriptor, `${String(process.pid)}\n`);
  return () => {
    const current = lstatSync(path, { throwIfNoEntry: false });
    closeSync(descriptor);
    if (current?.ino !== owned.ino || current.dev !== owned.dev) {
      throw new Error("Packaging output lock ownership changed");
    }
    rmSync(path);
  };
}
