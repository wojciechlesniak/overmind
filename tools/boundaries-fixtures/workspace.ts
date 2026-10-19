// SPDX-License-Identifier: Apache-2.0
import {
  constants,
  closeSync,
  openSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface FixtureWorkspace {
  readonly root: string;
  write: (path: string, contents: string | Uint8Array) => string;
  cleanup: () => void;
}

/** A unique plain-folder repository: no installation or ambient workspace state. */
export function createWorkspace(): FixtureWorkspace {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "overmind-boundaries-")));
  return {
    root,
    write(path, contents) {
      const absolute = resolve(root, path);
      const distance = relative(root, absolute);
      if (
        !distance ||
        isAbsolute(distance) ||
        distance === ".." ||
        distance.startsWith(`..${sep}`)
      ) {
        throw new Error("Fixture path escapes its workspace.");
      }
      let current = root;
      const device = lstatSync(root).dev;
      for (const part of distance.split(sep).slice(0, -1)) {
        current = resolve(current, part);
        let info = lstatSync(current, { throwIfNoEntry: false });
        if (!info) {
          mkdirSync(current);
          info = lstatSync(current);
        }
        if (!info.isDirectory() || info.isSymbolicLink() || info.dev !== device) {
          throw new Error("Fixture path must stay in its real workspace.");
        }
      }
      const existing = lstatSync(absolute, { throwIfNoEntry: false });
      if (
        existing &&
        (!existing.isFile() ||
          existing.isSymbolicLink() ||
          existing.nlink !== 1 ||
          existing.dev !== device)
      ) {
        throw new Error("Fixture output must be a regular unaliased file.");
      }
      const descriptor = openSync(
        absolute,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_TRUNC |
          constants.O_NOFOLLOW |
          constants.O_NONBLOCK,
        0o644,
      );
      try {
        writeFileSync(descriptor, contents);
      } finally {
        closeSync(descriptor);
      }
      return absolute;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
