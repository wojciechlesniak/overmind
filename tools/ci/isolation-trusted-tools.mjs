import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

/** The job user must not be able to replace a cleanup executable or its parents. */
export function trustedExecutable(path) {
  if (!isAbsolute(path) || /[\r\n]/u.test(path)) {
    throw new Error("Cleanup executable must have an absolute single-line path");
  }
  const executable = realpathSync(path);
  const file = lstatSync(executable);
  if (!file.isFile() || (file.mode & 0o111) === 0) {
    throw new Error("Cleanup executable is not executable");
  }
  for (let current = executable; ; current = dirname(current)) {
    const entry = lstatSync(current);
    if (entry.uid !== 0 || (entry.mode & 0o022) !== 0) {
      throw new Error(
        "Cleanup executables and their parents must be root-owned and immutable to the job user",
      );
    }
    // POSIX modes alone do not capture macOS ACL grants to the job account.
    let writable = false;
    try {
      accessSync(current, constants.W_OK);
      writable = true;
    } catch (error) {
      if (!["EACCES", "EPERM", "EROFS"].includes(error?.code)) {
        throw error;
      }
    }
    if (writable) {
      throw new Error("Cleanup path is writable by the job account");
    }
    if (current === dirname(current)) {
      break;
    }
  }
  return executable;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  console.log(trustedExecutable(process.argv[2] ?? ""));
}
