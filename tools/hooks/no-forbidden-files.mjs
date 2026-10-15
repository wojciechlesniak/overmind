import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function forbiddenFiles(files) {
  return files.filter((file) =>
    /^(?:\.env.*|id_rsa.*)$|\.(?:p12|p8|pem|key)$|\.keychain/iu.test(basename(file)),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rejected = forbiddenFiles(process.argv.slice(2).filter((file) => file !== "--"));
  if (rejected.length) {
    process.stderr.write(`Forbidden secret/key filenames: ${rejected.join(", ")}\n`);
    process.exitCode = 1;
  }
}
