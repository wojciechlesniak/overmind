import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { installSecurityTool } from "../secret-scan/install.ts";
import { readSBOM } from "./input.parse-boundary.ts";
import { completeLicenseEvidence, validateSBOM } from "./validate.ts";

function lockfile(root: string, path: string) {
  let current = root;
  for (const component of path.split("/")) {
    current = resolve(current, component);
    const file = lstatSync(current);
    if (file.isSymbolicLink()) {
      throw new Error("SBOM inputs cannot use symlinks");
    }
  }
  const file = lstatSync(current);
  if (
    !file.isFile() ||
    file.nlink !== 1 ||
    file.size > 32 * 1024 * 1024 ||
    relative(root, realpathSync(current)).startsWith(`..${sep}`)
  ) {
    throw new Error("Invalid lockfile input");
  }
  return current;
}
export async function generateSBOM(
  root: string,
  options: { binary?: string; gitEnv?: NodeJS.ProcessEnv } = {},
) {
  root = realpathSync(root);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    env: options.gitEnv,
    encoding: "utf8",
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw new Error("Invalid repository commit");
  }
  const optionalLocks = ["Cargo.lock", "apps/desktop/src-tauri/Cargo.lock"];
  const committedPaths = new Set(
    execFileSync("git", ["ls-tree", "--name-only", "-z", sha, "--", ...optionalLocks], {
      cwd: root,
      env: options.gitEnv,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean),
  );
  const paths = [
    "pnpm-lock.yaml",
    ...optionalLocks.filter(
      (path) =>
        committedPaths.has(path) ||
        Boolean(lstatSync(resolve(root, path), { throwIfNoEntry: false })),
    ),
  ];
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...paths], {
      cwd: root,
      env: options.gitEnv,
      stdio: "pipe",
    });
  } catch {
    throw new Error("SBOM lockfiles must be tracked and match the stated commit");
  }
  const fixture = mkdtempSync(resolve(tmpdir(), "overmind-sbom-"));
  try {
    const snapshot = resolve(fixture, "source");
    mkdirSync(snapshot);
    for (const path of paths) {
      const target = resolve(snapshot, path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(lockfile(root, path), target);
      const committed = execFileSync("git", ["show", `${sha}:${path}`], {
        cwd: root,
        env: options.gitEnv,
        maxBuffer: 32 * 1024 * 1024,
      });
      if (!readFileSync(target).equals(committed)) {
        throw new Error("SBOM lockfile snapshot does not match the stated commit");
      }
    }
    const raw = resolve(fixture, "raw.json");
    const config = resolve(fixture, "syft.yaml");
    writeFileSync(config, "{}\n", { mode: 0o600 });
    const result = spawnSync(
      options.binary ?? (await installSecurityTool("syft")),
      [
        "scan",
        `dir:${snapshot}`,
        "--config",
        config,
        "--override-default-catalogers",
        "javascript-lock-cataloger,rust-cargo-lock-cataloger",
        "--select-catalogers=-file",
        "--source-name",
        "overmind",
        "--source-version",
        sha,
        "--output",
        `cyclonedx-json@1.6=${raw}`,
      ],
      {
        encoding: "utf8",
        shell: false,
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          PATH: process.env["PATH"],
          HOME: fixture,
          LANG: "C.UTF-8",
          TZ: "UTC",
          SYFT_CHECK_FOR_APP_UPDATE: "false",
        },
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error("SBOM generator failed or is unavailable");
    }
    const document = validateSBOM(completeLicenseEvidence(readSBOM(raw)), paths.length > 1);
    const directory = resolve(root, "sbom");
    if (
      existsSync(directory) &&
      (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())
    ) {
      throw new Error("SBOM output must use a real directory");
    }
    mkdirSync(directory, { recursive: true });
    const temporary = resolve(directory, `${randomUUID()}.tmp`);
    const output = resolve(directory, `overmind-${sha}.cdx.json`);
    try {
      writeFileSync(temporary, JSON.stringify(document, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      renameSync(temporary, output);
    } finally {
      rmSync(temporary, { force: true });
    }
    return output;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await generateSBOM(resolve(import.meta.dirname, "../..")));
}
