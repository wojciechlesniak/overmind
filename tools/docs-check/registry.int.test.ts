import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { isolatedGitEnvironment } from "../hooks/git-test-environment.ts";
import { renderPluginRegistry } from "./plugin-registry.ts";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const generated = "tools/docs-check/plugin-registry.generated.ts";
const candidate = "tools/docs-probe/check.ts";
async function fixture(check: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ove-registry-cli-"));
  try {
    await mkdir(join(root, "tools/docs-check"), { recursive: true });
    await cp(join(source, "tools/docs-check"), join(root, "tools/docs-check"), {
      recursive: true,
      filter: (path) => !path.endsWith(".test.ts") && !path.endsWith(".md"),
    });
    for (const file of ["tools/adr/files.ts", "tools/hooks/git-test-environment.ts"]) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await cp(join(source, file), join(root, file));
    }
    await symlink(join(source, "node_modules"), join(root, "node_modules"));
    await cp(join(source, "package.json"), join(root, "package.json"));
    await writeFile(join(root, ".gitignore"), "node_modules\n");
    await writeFile(
      join(root, ".markdownlint-cli2.jsonc"),
      '{"config":{"MD013":false},"ignores":[]}',
    );
    await writeFile(join(root, "tools/docs-check/pending-links.json"), "{}");
    await writeFile(join(root, "README.md"), "# Fixture\n");
    await writeFile(join(root, "LICENSE"), "fixture license\n");
    await writeFile(join(root, generated), renderPluginRegistry([]));
    execFileSync("git", ["init", "--quiet", root], { env: isolatedGitEnvironment() });
    execFileSync("git", ["-C", root, "add", "."], { env: isolatedGitEnvironment() });
    await check(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function cli(root: string, args: string[] = []) {
  const start = performance.now();
  const activeManager = process.env["npm_execpath"];
  if (!activeManager || !isAbsolute(activeManager)) {
    throw new Error("The active pinned pnpm entry is unavailable.");
  }
  const manager = realpathSync(activeManager);
  if (!statSync(manager).isFile()) {
    throw new Error("The active pinned pnpm entry is unavailable.");
  }
  const result = spawnSync(manager, ["check:docs", ...args], {
    cwd: root,
    env: {
      ...isolatedGitEnvironment(),
      NODE_COMPILE_CACHE: join(root, ".node-compile-cache"),
      ...(process.env["NODE_V8_COVERAGE"] ? { NODE_DISABLE_COMPILE_CACHE: "1" } : {}),
    },
    encoding: "utf8",
    timeout: 10000,
  });
  expect(result.error).toBeUndefined();
  expect(performance.now() - start).toBeLessThan(10000);
  return result;
}
async function add(root: string, text: string): Promise<void> {
  await mkdir(dirname(join(root, candidate)), { recursive: true });
  await writeFile(join(root, candidate), text);
  execFileSync("git", ["-C", root, "add", candidate], { env: isolatedGitEnvironment() });
}
it("actual public CLI executes an automatically added plugin and removes its static entry next invocation", async () => {
  await fixture(async (root) => {
    await add(
      root,
      'export default {name:"probe",run(ctx){return [{file:"README.md",line:1,rule:"auto-probe",severity:"warning",message:ctx.flags.publish ? "Publish probe." : "Default probe."}]}};',
    );
    const added = cli(root, ["--publish", "--github"]);
    expect(added.status).toBe(0);
    expect(added.stdout).toContain("auto-probe | Publish probe.");
    expect(added.stdout).toContain("::warning file=README.md,line=1::auto-probe");
    expect(await readFile(join(root, generated), "utf8")).toContain("../docs-probe/check.ts");
    execFileSync("git", ["-C", root, "rm", "--cached", candidate], {
      env: isolatedGitEnvironment(),
    });
    await unlink(join(root, candidate));
    const removed = cli(root);
    expect(removed.status).toBe(0);
    expect(removed.stdout).not.toContain("auto-probe");
    expect(await readFile(join(root, generated), "utf8")).toBe(renderPluginRegistry([]));
    expect(cli(root, ["--i18n"]).status).toBe(1);
  });
});
it.each(["malformed", "symlink", "escape"])(
  "actual public CLI denies a %s candidate before execution and preserves the registry",
  async (kind) => {
    await fixture(async (root) => {
      const marker = join(root, "executed.txt");
      const executable =
        'import {writeFileSync} from "node:fs"; writeFileSync("executed.txt","executed"); export default {name:"probe",run(){return []}};';
      await add(root, kind === "malformed" ? executable + " export const = ;" : executable);
      let outside: string | undefined;
      try {
        if (kind !== "malformed") {
          await unlink(join(root, candidate));
          if (kind === "escape") {
            outside = await mkdtemp(join(tmpdir(), "ove-registry-outside-"));
            await writeFile(join(outside, "check.ts"), executable);
            await symlink(join(outside, "check.ts"), join(root, candidate));
          } else {
            await writeFile(join(root, "target.ts"), executable);
            await symlink("../../target.ts", join(root, candidate));
          }
        }
        const before = await readFile(join(root, generated));
        const denied = cli(root);
        expect(denied.status).toBe(1);
        expect(denied.stdout).toContain(
          "configuration | Documentation checks could not load trusted repository input.",
        );
        expect(denied.stdout).not.toContain("writeFileSync");
        expect(await readFile(join(root, generated))).toEqual(before);
        await expect(readFile(marker)).rejects.toThrow();
      } finally {
        if (outside) {
          await rm(outside, { recursive: true, force: true });
        }
      }
    });
  },
);

it("the actual external-root CLI rejects nonempty foreign registry before candidate execution", async () => {
  await fixture(async (root) => {
    await add(
      root,
      'import {writeFileSync} from "node:fs"; writeFileSync("executed.txt","executed"); export default {name:"probe",run(){return []}};',
    );
    const checked = spawnSync(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), join(source, "tools/docs-check/run.ts")],
      { cwd: root, env: isolatedGitEnvironment(), encoding: "utf8", timeout: 10000 },
    );
    expect(checked.error).toBeUndefined();
    expect(checked.status).toBe(1);
    expect(checked.stdout).toContain(
      "configuration | Documentation checks could not load trusted repository input.",
    );
    expect(checked.stdout).not.toContain("writeFileSync");
    await expect(readFile(join(root, "executed.txt"))).rejects.toThrow();
  });
});
