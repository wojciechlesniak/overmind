import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
const forbidden = (name) =>
  /(^|\/)apps\/desktop(\/|$)|(^|\/)react(?:-dom)?(\/|$)|(^|\/)@tauri-apps\//.test(name);

export function guardMetafile(metafile, dependencies, root) {
  for (const input of Object.keys(metafile.inputs)) {
    const path = realpathSync(resolve(root, input));
    const normalized = path.replaceAll("\\", "/");
    const packages = [...normalized.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)];
    const name = packages.at(-1)?.[1];
    if (forbidden(normalized) || (name !== undefined && !Object.hasOwn(dependencies, name))) {
      throw new Error(`Forbidden engine bundle input: ${relative(root, path)}`);
    }
    const distance = relative(root, path);
    if (distance.startsWith("../") || isAbsolute(distance)) {
      throw new Error("Engine bundle input escapes the repository");
    }
  }
  for (const output of Object.values(metafile.outputs)) {
    for (const item of output.imports) {
      if (
        item.external &&
        !(item.path.startsWith("node:") && builtins.has(item.path.slice(5))) &&
        !["../compose/index.js", "../service/index.js"].includes(item.path)
      ) {
        throw new Error(`Forbidden external engine import: ${item.path}`);
      }
    }
  }
}

export async function bundleEngine({
  root = repository,
  outfile = resolve(root, "apps/engine/dist/engine.cjs"),
} = {}) {
  root = realpathSync(root);
  outfile = resolve(outfile);
  const app = resolve(root, "apps/engine");
  const manifest = JSON.parse(readFileSync(resolve(app, "package.json"), "utf8"));
  const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
  const contractPath = resolve(root, "packages/contracts/src/index.ts");
  // Pinned Node22 supports stripping erasable TypeScript from our own contract module.
  const contracts = existsSync(contractPath) ? await import(pathToFileURL(contractPath).href) : {};
  const protocol = Object.hasOwn(contracts, "PROTOCOL_VERSION") ? contracts.PROTOCOL_VERSION : 1;
  if (!Number.isSafeInteger(protocol) || protocol < 1) {
    throw new Error("Invalid contracts protocol version");
  }
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
    throw new Error("Invalid root package version");
  }
  let sha = "dev";
  try {
    sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    /* A source archive has no Git metadata. */
  }
  if (!/^(?:dev|[a-f0-9]{7,40})$/.test(sha)) {
    throw new Error("Invalid build SHA");
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["apps/engine/src/main.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    banner: {
      js: 'const __OVERMIND_MODULE_URL__ = require("node:url").pathToFileURL(__filename).href;',
    },
    outfile,
    sourcemap: "external",
    minify: false,
    legalComments: "linked",
    metafile: true,
    write: false,
    logOverride: { "ignored-dynamic-import": "warning" },
    define: {
      "import.meta.url": "__OVERMIND_MODULE_URL__",
      __OVERMIND_VERSION__: JSON.stringify(version),
      __PROTOCOL_VERSION__: String(protocol),
      __BUILD_SHA__: JSON.stringify(sha),
    },
  });
  guardMetafile(result.metafile, manifest.dependencies ?? {}, root);
  const outputs = result.outputFiles.map((file) => {
    if (!file.path.endsWith(".map")) {
      return file;
    }
    const map = JSON.parse(file.text);
    map.sources = map.sources.map((source) => {
      const path = relative(root, resolve(dirname(file.path), source)).replaceAll("\\", "/");
      if (path.startsWith("../") || isAbsolute(path)) {
        throw new Error("Source map escapes repository");
      }
      return `file:///overmind/source/${path}`;
    });
    map.sourceRoot = "";
    return { path: file.path, contents: `${JSON.stringify(map)}\n` };
  });
  mkdirSync(dirname(outfile), { recursive: true });
  for (const output of outputs) {
    writeFileSync(output.path, output.contents);
  }
  writeFileSync(
    resolve(dirname(outfile), "engine.meta.json"),
    `${JSON.stringify(result.metafile, null, 2)}\n`,
  );
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { "out-dir": { type: "string" } }, strict: true });
    await bundleEngine(
      values["out-dir"] === undefined ? {} : { outfile: resolve(values["out-dir"], "engine.cjs") },
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Engine bundle failed"}\n`);
    process.exitCode = 1;
  }
}
