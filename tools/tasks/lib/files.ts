import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative } from "node:path";
import { TaskToolError } from "./errors.ts";

export interface FileSystem {
  readText(path: string, maxBytes?: number): string;
  real(path: string): string;
  isSymlink(path: string): boolean;
  entries(path: string): { name: string; directory: boolean; symlink: boolean }[];
}

export const nodeFiles: FileSystem = {
  readText(path, maxBytes = 256 * 1024) {
    const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(descriptor);
      if (!stat.isFile() || stat.size > maxBytes) {
        throw new TaskToolError(4, "Input must be a bounded regular file");
      }
      const buffer = Buffer.alloc(maxBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = readSync(descriptor, buffer, length, buffer.length - length, null);
        if (!read) {
          break;
        }
        length += read;
      }
      if (length > maxBytes) {
        throw new TaskToolError(4, "Input exceeds its size limit");
      }
      return buffer.subarray(0, length).toString("utf8");
    } finally {
      closeSync(descriptor);
    }
  },
  real: realpathSync,
  isSymlink: (path) => lstatSync(path).isSymbolicLink(),
  entries: (path) =>
    readdirSync(path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      directory: entry.isDirectory(),
      symlink: entry.isSymbolicLink(),
    })),
};

export function confinedPath(files: FileSystem, root: string, path: string): string {
  const canonical = files.real(path);
  const distance = relative(files.real(root), canonical);
  if (distance === ".." || distance.startsWith("../") || isAbsolute(distance)) {
    throw new TaskToolError(4, "Task input escapes the repository");
  }
  return canonical;
}
