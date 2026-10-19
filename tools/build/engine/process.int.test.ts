// SPDX-License-Identifier: Apache-2.0
import {
  execFileSync,
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection, type Socket } from "node:net";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { afterAll, beforeAll, expect, it } from "vitest";
import { bundleEngine } from "./bundle.mjs";
import { readJsonRecord } from "../../test-support/json.parse-boundary.ts";

const root = resolve(import.meta.dirname, "../../..");
const require = createRequire(import.meta.url);
let temporary: string;
let bundle: string;
const children = new Set<ChildProcessWithoutNullStreams>();
let outputIndex = 0;
function readOutput(text: string): Record<string, unknown> {
  const path = resolve(temporary, `output-${String(outputIndex++)}.json`);
  writeFileSync(path, text);
  return readJsonRecord(path);
}
beforeAll(async () => {
  temporary = mkdtempSync(resolve(tmpdir(), "ove016-process-"));
  bundle = resolve(temporary, "engine.cjs");
  await bundleEngine({ outfile: bundle });
});
afterAll(() => {
  for (const child of children) {
    child.kill("SIGKILL");
  }
  rmSync(temporary, { recursive: true, force: true });
});
function execute(entry: string, args: string[], source = false) {
  return spawnSync(
    process.execPath,
    [...(source ? ["--import", require.resolve("tsx")] : []), entry, ...args],
    { encoding: "utf8", timeout: 10000, cwd: root },
  );
}
it("bundled and tsx commands enforce channel, exit and argument contracts", () => {
  for (const [entry, source] of [
    [bundle, false],
    [resolve(root, "apps/engine/src/main.ts"), true],
  ] as const) {
    const info = execute(entry, ["version", "--json"], source);
    expect(info.status).toBe(0);
    expect(info.stderr).toBe("");
    expect(info.stdout.trim().split("\n")).toHaveLength(1);
    expect(readOutput(info.stdout)).toMatchObject({
      version: source ? "0.0.0-dev" : "0.0.0",
      protocol: 1,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    });
    expect(readOutput(info.stdout)["buildSha"]).toEqual(
      source ? "dev" : expect.stringMatching(/^[a-f0-9]{12}$/),
    );
    const ensure = execute(entry, ["ensure-running", "--json"], source);
    expect(ensure.status).toBe(20);
    expect(ensure.stdout.trim().split("\n")).toHaveLength(1);
    expect(readOutput(ensure.stdout)).toMatchObject({
      status: "failed",
      pid: null,
      socket: null,
      protocol: 1,
    });
    expect(ensure.stderr).toBe("engine bootstrap not implemented\n");
    expect(execute(entry, ["run"], source).status).toBe(20);
    for (const args of [["bad"], ["version", "--bad"], ["run", "--data-dir", "x".repeat(4096)]]) {
      const invalid = execute(entry, args, source);
      expect(invalid.status).toBe(64);
      expect(invalid.stdout).toBe("");
      expect(invalid.stderr).toContain("Usage:");
    }
    const help = execute(entry, ["--help", "--json"], source);
    expect(help.status).toBe(0);
    expect(help.stdout).toBe("");
    expect(help.stderr).toContain("Usage:");
  }
});
function fixture(name: string, code: string, service = false): string {
  const directory = resolve(temporary, name);
  const app = resolve(directory, "apps/engine");
  mkdirSync(app, { recursive: true });
  cpSync(resolve(root, "apps/engine/src"), resolve(app, "src"), { recursive: true });
  cpSync(resolve(root, "apps/engine/package.json"), resolve(app, "package.json"));
  cpSync(resolve(root, "package.json"), resolve(directory, "package.json"));
  symlinkSync(resolve(root, "node_modules"), resolve(directory, "node_modules"));
  mkdirSync(resolve(app, "src", service ? "service" : "compose"), { recursive: true });
  writeFileSync(resolve(app, "src", service ? "service/index.ts" : "compose/index.ts"), code);
  return directory;
}
async function fixtureBundle(name: string, code: string, service = false): Promise<string> {
  const directory = fixture(name, code, service);
  const output = resolve(directory, "dist/engine.cjs");
  await bundleEngine({ root: directory, outfile: output });
  return output;
}
function launch(entry: string) {
  const child = spawn(
    process.execPath,
    [entry, "run", "--foreground", "--data-dir", "../as-data"],
    { stdio: "pipe" },
  );
  children.add(child);
  return child;
}
function output(child: ChildProcessWithoutNullStreams, marker: string): Promise<void> {
  return new Promise((resolveOutput, reject) => {
    let text = "";
    const timeout = setTimeout(() => {
      reject(new Error(`missing fixture marker ${marker}`));
    }, 3000);
    child.stderr.on("data", (data: Buffer) => {
      text += data.toString();
      if (text.includes(marker)) {
        clearTimeout(timeout);
        resolveOutput();
      }
    });
  });
}
function exit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolveExit) => {
    child.once("exit", (code) => {
      children.delete(child);
      resolveExit(code);
    });
  });
}
const start = `export async function startEngine(options) { if(options.dataDir !== "../as-data" || !options.foreground) throw new Error("options mismatch"); process.stderr.write("ready\\n"); await new Promise(() => {setInterval(()=>{},1000)}); }`;
it("normal service detail is bounded and redacted identically in JSON and stderr", async () => {
  const entry = await fixtureBundle(
    "unsafe-detail",
    `import {homedir} from "node:os"; export async function ensureRunning(){return {status:"failed",pid:null,socket:null,detail:"\\x1b[31m"+homedir()+"/private\\n"+"x".repeat(600)}}`,
    true,
  );
  const result = execute(entry, ["ensure-running", "--json"]);
  expect(result.status).toBe(20);
  expect(result.stdout.trim().split("\n")).toHaveLength(1);
  const detail = readOutput(result.stdout)["detail"];
  expect(typeof detail).toBe("string");
  expect(detail).not.toContain(homedir());
  expect(detail).not.toMatch(/\p{Cc}/u);
  expect(detail).toHaveLength(512);
  expect(result.stderr).toBe(`${String(detail)}\n`);
});
it.each(["SIGTERM", "SIGINT"] as const)(
  "actual %s calls shutdown and exits successfully",
  async (signal) => {
    const entry = await fixtureBundle(
      signal,
      `${start}\nexport async function shutdown(){ process.stderr.write("shutdown\\n"); }`,
    );
    const child = launch(entry);
    await output(child, "ready");
    const stopped = exit(child);
    const shutdown = output(child, "shutdown");
    child.kill(signal);
    await shutdown;
    expect(await stopped).toBe(0);
  },
);
it("actual hanging shutdown is abandoned at five seconds", { timeout: 10000 }, async () => {
  const entry = await fixtureBundle(
    "hanging",
    `${start}\nexport async function shutdown(){ process.stderr.write("shutdown\\n"); await new Promise(()=>{}); }`,
  );
  const child = launch(entry);
  await output(child, "ready");
  const stopped = exit(child);
  const began = performance.now();
  child.kill("SIGTERM");
  expect(await stopped).toBe(0);
  expect(performance.now() - began).toBeGreaterThanOrEqual(4900);
  expect(performance.now() - began).toBeLessThan(6500);
});
it("a second signal exits immediately with 130", async () => {
  const entry = await fixtureBundle(
    "twice",
    `${start}\nexport async function shutdown(){ process.stderr.write("shutdown\\n"); await new Promise(()=>{}); }`,
  );
  const child = launch(entry);
  await output(child, "ready");
  const stopped = exit(child);
  const stopping = output(child, "shutdown");
  child.kill("SIGTERM");
  await stopping;
  child.kill("SIGINT");
  expect(await stopped).toBe(130);
});
it.each([
  ["deadline", 0],
  ["second signal", 130],
] as const)(
  "start failure during active shutdown preserves the %s exit",
  { timeout: 10000 },
  async (mode, expected) => {
    const entry = await fixtureBundle(
      `shutdown-race-${String(expected)}`,
      `let rejectStart; setInterval(()=>{},1000);
export function startEngine(){process.stderr.write("ready\\n");return new Promise((_,reject)=>{rejectStart=reject})}
export async function shutdown(){rejectStart(new Error("fixture start rejected after signal"));await new Promise(()=>{})}`,
    );
    const child = launch(entry);
    await output(child, "ready");
    const stopped = exit(child);
    const failed = output(child, "fixture start rejected after signal");
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL");
    }, 6500);
    const began = performance.now();
    try {
      child.kill("SIGTERM");
      await failed;
      if (mode === "second signal") {
        child.kill("SIGINT");
      }
      expect(await stopped).toBe(expected);
      if (mode === "deadline") {
        expect(performance.now() - began).toBeGreaterThanOrEqual(4900);
        expect(performance.now() - began).toBeLessThan(6500);
      }
    } finally {
      clearTimeout(watchdog);
    }
  },
);
it("errors thrown inside present hooks are internal errors, never missing-hook stubs", async () => {
  const entry = await fixtureBundle(
    "broken",
    `throw new Error("fixture import failed"); export async function ensureRunning(){}`,
    true,
  );
  const result = execute(entry, ["ensure-running", "--json"]);
  expect(result.status).toBe(70);
  expect(result.stderr).toBe("fixture import failed\n");
  expect(readOutput(result.stdout)).toMatchObject({
    status: "failed",
    detail: "fixture import failed",
  });
  for (const [name, missing] of [
    ["nested", "./missing-dependency.js"],
    ["nested-same-name", "../nested/service/index.js"],
  ] as const) {
    const nested = fixture(
      name,
      `await import(${JSON.stringify(missing)}); export async function ensureRunning(){}`,
      true,
    );
    const source = resolve(nested, "apps/engine/src/main.ts");
    const error = execute(source, ["ensure-running", "--json"], true);
    expect(error.status).toBe(70);
    expect(readOutput(error.stdout)["status"]).toBe("failed");
  }
});
it("closed stdout is handled silently for version and as internal failure otherwise", async () => {
  const many = await fixtureBundle(
    "large",
    `export async function ensureRunning(){return {status:"failed",pid:null,socket:null,detail:"x".repeat(1000000)}}`,
    true,
  );
  for (const [entry, args, expected] of [
    [bundle, ["version", "--json"], 0],
    [many, ["ensure-running", "--json"], 70],
  ] as const) {
    const child = spawn(process.execPath, [entry, ...args], { stdio: "pipe" });
    children.add(child);
    let stderr = "";
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.stdout.destroy();
    const stopped = exit(child);
    expect(await stopped).toBe(expected);
    expect(stderr).not.toContain("EPIPE");
  }
});
it("writes maps/metafile and rejects real UI and undeclared dependency fixture imports", async () => {
  expect(readFileSync(`${bundle}.map`, "utf8")).toContain(
    "file:///overmind/source/apps/engine/src/main.ts",
  );
  expect(readFileSync(`${bundle}.map`, "utf8")).not.toContain(root);
  expect(readOutput(readFileSync(resolve(temporary, "engine.meta.json"), "utf8"))).toHaveProperty(
    "inputs",
  );
  for (const dependency of ["react", "semver"]) {
    const directory = fixture(
      `guard-${dependency}`,
      `export async function startEngine(){} export async function shutdown(){}`,
      false,
    );
    writeFileSync(
      resolve(directory, "apps/engine/src/main.ts"),
      `import * as module from ${JSON.stringify(dependency)}; process.stdout.write(String(module));`,
    );
    await expect(
      bundleEngine({ root: directory, outfile: resolve(directory, "dist/engine.cjs") }),
    ).rejects.toThrow("Forbidden engine bundle input");
  }
  const first = resolve(temporary, "repeat1/engine.cjs");
  const second = resolve(temporary, "repeat2/engine.cjs");
  await bundleEngine({ outfile: first });
  await bundleEngine({ outfile: second });
  expect(readFileSync(first)).toEqual(readFileSync(second));
  expect(readFileSync(`${first}.map`)).toEqual(readFileSync(`${second}.map`));
  expect(
    execFileSync(process.execPath, [first, "version", "--json"], { encoding: "utf8" }),
  ).toContain('"protocol":1');
});
it("stamps the single contracts protocol constant and rejects invalid values", async () => {
  for (const [name, protocol] of [
    ["protocol-valid", "7"],
    ["protocol-invalid", '"1"'],
  ] as const) {
    const directory = fixture(
      name,
      "export async function startEngine(){} export async function shutdown(){}",
      false,
    );
    const contracts = resolve(directory, "packages/contracts/src");
    mkdirSync(contracts, { recursive: true });
    writeFileSync(
      resolve(contracts, "index.ts"),
      `export const PROTOCOL_VERSION: number = ${protocol};`,
    );
    const outfile = resolve(directory, "dist/engine.cjs");
    if (protocol === "7") {
      await bundleEngine({ root: directory, outfile });
      const result = execute(outfile, ["version", "--json"]);
      expect(result.status).toBe(0);
      expect(readOutput(result.stdout)).toMatchObject({ protocol: 7, buildSha: "dev" });
    } else {
      await expect(bundleEngine({ root: directory, outfile })).rejects.toThrow(
        "Invalid contracts protocol version",
      );
    }
  }
});

it("static protocol integration stamps a literal without executing contracts", async () => {
  const directory = fixture(
    "protocol-static-throw",
    "export async function startEngine(){} export async function shutdown(){}",
  );
  const contracts = resolve(directory, "packages/contracts/src");
  mkdirSync(contracts, { recursive: true });
  writeFileSync(
    resolve(contracts, "index.ts"),
    'throw new Error("Contract code must not execute"); export const PROTOCOL_VERSION = 7;',
  );
  const outfile = resolve(directory, "dist/engine.cjs");
  await bundleEngine({ root: directory, outfile });
  const result = execute(outfile, ["version", "--json"]);
  expect(result.status).toBe(0);
  expect(readOutput(result.stdout)).toMatchObject({ protocol: 7, buildSha: "dev" });
});
it("static protocol integration rejects a computed protocol instead of executing it", async () => {
  const directory = fixture(
    "protocol-static-computed",
    "export async function startEngine(){} export async function shutdown(){}",
  );
  const contracts = resolve(directory, "packages/contracts/src");
  mkdirSync(contracts, { recursive: true });
  writeFileSync(resolve(contracts, "index.ts"), 'export const PROTOCOL_VERSION = Number("7");');
  await expect(
    bundleEngine({ root: directory, outfile: resolve(directory, "dist/engine.cjs") }),
  ).rejects.toThrow("Invalid contracts protocol version");
});

it("the actual compiled CLI closes a real Unix socket on SIGTERM", async () => {
  const socketDirectory = realpathSync(mkdtempSync("/tmp/ove033-uds-"));
  const socketPath = resolve(socketDirectory, "engine.sock");
  let child: ChildProcessWithoutNullStreams | undefined;
  let connection: Socket | undefined;
  let stopped: Promise<number | null> | undefined;
  try {
    const entry = await fixtureBundle(
      "unix-socket",
      `import { createServer } from "node:net";
let server;
export async function startEngine() {
  server = createServer(socket => socket.once("data", data => socket.end(data.toString() === "ping" ? "pong" : "invalid")));
  await new Promise((_, reject) => {
    server.once("error", reject);
    server.listen(${JSON.stringify(socketPath)}, () => process.stderr.write("ready\\n"));
  });
}
export async function shutdown() {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}`,
    );
    child = launch(entry);
    stopped = exit(child);
    await output(child, "ready");
    const client = createConnection(socketPath);
    connection = client;
    const response = await new Promise<string>((resolveResponse, reject) => {
      let text = "";
      client.setEncoding("utf8");
      client.setTimeout(3000, () => client.destroy(new Error("Unix socket response timed out")));
      client.on("data", (data: string) => {
        text += data;
        if (text.length > 4) {
          client.destroy(new Error("Unexpected Unix socket response"));
        }
      });
      client.once("error", reject);
      client.once("end", () => {
        resolveResponse(text);
      });
      client.once("connect", () => client.end("ping"));
    });
    expect(response).toBe("pong");
    client.destroy();
    child.kill("SIGTERM");
    expect(await stopped).toBe(0);
    expect(existsSync(socketPath)).toBe(false);
  } finally {
    connection?.destroy();
    if (child?.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    if (stopped) {
      await stopped;
    }
    rmSync(socketDirectory, { recursive: true, force: true });
  }
});
