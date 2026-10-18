import {
  constants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  readdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  type BigIntStats,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
function identity(stat: BigIntStats): string {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.uid,
    stat.nlink,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join(":");
}
export class Files {
  readonly root: string;
  constructor(root: string) {
    this.root = realpathSync(root);
  }
  path(path: string, missing = false): string {
    const target = resolve(this.root, path);
    const distance = relative(this.root, target);
    if (
      /\p{Cc}/u.test(distance) ||
      isAbsolute(distance) ||
      distance === ".." ||
      distance.startsWith(`..${sep}`)
    ) {
      throw new Error("ADR path escapes repository");
    }
    let current = this.root;
    const device = lstatSync(current).dev;
    const parts = distance.split(sep).filter(Boolean);
    for (const [index, part] of parts.entries()) {
      current = resolve(current, part);
      const stat = lstatSync(current, { throwIfNoEntry: false });
      if (!stat && missing && index === parts.length - 1) {
        return target;
      }
      if (
        !stat ||
        stat.isSymbolicLink() ||
        stat.dev !== device ||
        stat.uid !== process.getuid?.() ||
        (index < parts.length - 1 && !stat.isDirectory())
      ) {
        throw new Error("ADR paths must be real, owned and on the repository volume");
      }
    }
    return target;
  }
  read(path: string): string {
    path = this.path(path);
    const before = lstatSync(path, { bigint: true });
    const limit = 2 * 1024 * 1024;
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit)) {
      throw new Error("ADR input must be a bounded regular file");
    }
    const descriptor = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      if (identity(fstatSync(descriptor, { bigint: true })) !== identity(before)) {
        throw new Error("ADR input changed before read");
      }
      const bytes = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < bytes.length) {
        const count = readSync(descriptor, bytes, length, bytes.length - length, null);
        if (!count) {
          break;
        }
        length += count;
      }
      if (
        length > limit ||
        BigInt(length) !== before.size ||
        identity(fstatSync(descriptor, { bigint: true })) !== identity(before) ||
        identity(lstatSync(path, { bigint: true })) !== identity(before)
      ) {
        throw new Error("ADR input changed or exceeds limit");
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
    } finally {
      closeSync(descriptor);
    }
  }
  write(path: string, text: string, previous?: string): void {
    path = this.path(path, true);
    if (previous === undefined) {
      writeFileSync(path, text, { flag: "wx", mode: 0o644 });
      return;
    }
    if (this.read(path) !== previous) {
      throw new Error("ADR output changed during planning");
    }
    const temporary = resolve(dirname(path), `.adr-${randomUUID()}.tmp`);
    const descriptor = openSync(temporary, "wx", 0o644);
    let owned: BigIntStats | undefined;
    try {
      owned = fstatSync(descriptor, { bigint: true });
      writeFileSync(descriptor, text);
      if (this.read(path) !== previous) {
        throw new Error("ADR output changed during publication");
      }
      const current = lstatSync(temporary, { bigint: true, throwIfNoEntry: false });
      const written = fstatSync(descriptor, { bigint: true });
      if (
        !current ||
        !current.isFile() ||
        written.nlink !== 1n ||
        identity(current) !== identity(written)
      ) {
        throw new Error("ADR temporary output changed before publication");
      }
      renameSync(temporary, path);
    } finally {
      try {
        if (owned) {
          const current = lstatSync(temporary, { bigint: true, throwIfNoEntry: false });
          if (current?.dev === owned.dev && current.ino === owned.ino) {
            rmSync(temporary, { force: true });
          }
        }
      } finally {
        closeSync(descriptor);
      }
    }
  }
  remove(path: string, previous: string): void {
    path = this.path(path);
    if (this.read(path) !== previous) {
      throw new Error("ADR file changed before removal");
    }
    rmSync(path);
  }
  locked<T>(run: () => T): T {
    const path = this.path("docs/adr/.adr-tool.lock", true);
    const descriptor = openSync(path, "wx", 0o600);
    const owned = fstatSync(descriptor);
    const release = () => {
      closeSync(descriptor);
      const current = lstatSync(path);
      if (current.dev !== owned.dev || current.ino !== owned.ino) {
        throw new Error("ADR mutation lock ownership changed");
      }
      rmSync(path);
    };
    try {
      writeFileSync(descriptor, `${String(process.pid)}\n`);
      return run();
    } finally {
      release();
    }
  }

  markdown(directory: string): string[] {
    const paths: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(this.path(directory), { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        this.path(path);
        if (entry.isDirectory()) {
          visit(path);
        } else if (entry.name.endsWith(".md")) {
          paths.push(path);
          if (paths.length > 10000) {
            throw new Error("Too many ADR reference documents");
          }
        }
      }
    };
    visit(this.path(directory));
    return paths.sort();
  }
}
