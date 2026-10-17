import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function canonicalFile(
  root: string,
  file: string,
  executable = false,
): Promise<string> {
  const base = await realpath(root);
  if (
    isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some((part) => part === ".." || !part)
  ) {
    throw new Error("Invalid repository path.");
  }
  const target = resolve(base, file);
  if (executable) {
    let path = base;
    for (const part of file.split("/")) {
      path = resolve(path, part);
      if ((await lstat(path)).isSymbolicLink()) {
        throw new Error("Executable aliases are forbidden.");
      }
    }
  }
  const canonical = await realpath(target);
  const difference = relative(base, canonical);
  if (difference === ".." || difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error("Path escapes repository.");
  }
  const info = await stat(canonical);
  if (!info.isFile() || info.dev !== (await stat(base)).dev || info.size > 1_048_576) {
    throw new Error("Unsupported repository file.");
  }
  return canonical;
}

export async function readRepositoryFile(
  root: string,
  file: string,
  executable = false,
): Promise<string> {
  const canonical = await canonicalFile(root, file, executable);
  const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    const contents = await handle.readFile("utf8");
    const after = await stat(await canonicalFile(root, file, executable));
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      throw new Error("Repository file changed while reading.");
    }
    return contents;
  } finally {
    await handle.close();
  }
}
