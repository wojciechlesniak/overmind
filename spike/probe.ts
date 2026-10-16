import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { buildCandidate, runtimes } from "./build.mjs";
import { number, parseLine } from "./probe-input.parse-boundary.ts";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const data = mkdtempSync("/private/tmp/ove11-");
const output = resolve(root, "spike/dist/measurements.ndjson");
writeFileSync(output, "");
const runs = Number(process.env["OVE011_RUNS"] ?? "10");
const candidates = (process.env["OVE011_CANDIDATES"] ?? "A,B,C").split(",");
if (!Number.isInteger(runs) || runs < 1 || runs > 10) {
  throw new Error("Invalid run count");
}
async function socketRequest(path: string): Promise<string> {
  const socket = createConnection(path);
  const chunks: Buffer[] = [];
  socket.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  try {
    await Promise.race([
      once(socket, "end"),
      delay(2000).then(() => {
        throw new Error("Socket deadline");
      }),
    ]);
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    socket.destroy();
  }
}
async function detach(executable: string, directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const result = parseLine(
    execFileSync(runtimes.node, [resolve(root, "spike/detach-parent.mjs"), executable, directory], {
      encoding: "utf8",
      timeout: 3000,
    }),
  );
  const pid = number(result["pid"]);
  if (pid <= 1) {
    throw new Error("Unsafe detached PID");
  }
  try {
    let connected = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await socketRequest(join(directory, "engine.sock"));
        connected = true;
        break;
      } catch {
        await delay(20);
      }
    }
    if (!connected) {
      throw new Error("Detached child failed after parent exit");
    }
    process.kill(pid, 0);
  } finally {
    process.kill(pid, "SIGTERM");
  }
}
for (const candidate of candidates) {
  for (let iteration = 1; iteration <= runs; iteration++) {
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const built = await buildCandidate(candidate, iteration);
      const version = parseLine(
        execFileSync(built.executable, ["--mode", "version"], { encoding: "utf8", timeout: 5000 }),
      );
      if (version["version"] !== "0.0.0-ove011" || version["protocol"] !== 1) {
        throw new Error("Embedded version mismatch");
      }
      const incompatible = spawnSync(
        built.executable,
        ["--mode", "version", "--expected-protocol", "2"],
        { encoding: "utf8", timeout: 5000 },
      );
      if (incompatible.status !== 30) {
        throw new Error("Protocol mismatch did not fail closed");
      }
      const directory = join(data, candidate, String(iteration));
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const started = performance.now();
      child = spawn(built.executable, ["--mode", "serve", "--dir", directory], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let diagnostics = "";
      child.stderr?.on("data", (bytes: Buffer) => {
        diagnostics = (diagnostics + bytes.toString("utf8")).slice(0, 4096);
      });
      const stdout = child.stdout;
      if (!stdout) {
        throw new Error("Missing ready stream");
      }
      const ready = await Promise.race([
        once(stdout, "data"),
        once(child, "exit").then(() => {
          throw new Error(`Engine exited before ready: ${diagnostics}`);
        }),
        delay(5000).then(() => {
          throw new Error("Startup deadline");
        }),
      ]);
      const chunk: unknown = ready[0];
      if (!Buffer.isBuffer(chunk)) {
        throw new Error("Invalid ready bytes");
      }
      const receipt = parseLine(chunk.toString("utf8"));
      const startupMs = performance.now() - started;
      if (receipt["ready"] !== true || receipt["mode"] !== 0o600) {
        throw new Error("Socket mode failed");
      }
      const response = parseLine(await socketRequest(join(directory, "engine.sock")));
      if (response["version"] !== "0.0.0-ove011") {
        throw new Error("Unix response failed");
      }
      const featureResult = await execute(
        built.executable,
        ["--mode", "features", "--dir", directory, "--extension", runtimes.extension],
        { encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024 },
      );
      const features = parseLine(featureResult.stdout);
      const mapped = spawnSync(built.executable, ["--mode", "stack"], {
        encoding: "utf8",
        timeout: 5000,
      });
      const sourceMapped = mapped.status === 1 && /spike\/entry\.ts:\d+:\d+/u.test(mapped.stderr);
      if (iteration === 1) {
        await detach(built.executable, join(directory, "detached"));
        writeFileSync(resolve(root, `spike/dist/${candidate}-source-map-stack.txt`), mapped.stderr);
      }
      await delay(Math.max(0, 30000 - (performance.now() - started)));
      if (!child.pid) {
        throw new Error("Missing process PID");
      }
      const rssKiB = Number(
        execFileSync("/bin/ps", ["-o", "rss=", "-p", String(child.pid)], {
          encoding: "utf8",
        }).trim(),
      );
      if (!Number.isFinite(rssKiB) || rssKiB <= 0) {
        throw new Error("Invalid idle RSS");
      }
      const exit = once(child, "exit");
      const signalStart = performance.now();
      child.kill("SIGTERM");
      const stopped = await Promise.race([
        exit,
        delay(2000).then(() => {
          throw new Error("SIGTERM deadline");
        }),
      ]);
      if (stopped[0] !== 0) {
        throw new Error("Unclean SIGTERM");
      }
      const result = {
        ...built,
        executableBytes: statSync(built.executable).size,
        companionBytes: built.companions.reduce((sum, path) => sum + statSync(path).size, 0),
        version,
        startupMs,
        idleRssMiB: rssKiB / 1024,
        shutdownMs: performance.now() - signalStart,
        sourceMapped,
        features,
        signing: "ad-hoc hardened runtime, allow-jit only; not notarized",
      };
      const line = JSON.stringify(result) + "\n";
      appendFileSync(output, line);
      process.stdout.write(line);
    } catch (error) {
      const line =
        JSON.stringify({
          candidate,
          iteration,
          error: error instanceof Error ? error.message : "Unknown failure",
        }) + "\n";
      appendFileSync(output, line);
      process.stdout.write(line);
      break;
    } finally {
      child?.kill("SIGKILL");
    }
  }
}
