import { createServer } from "node:net";
import { chmodSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { openDatabase, driver } from "#driver";
import { configure, features } from "./features.ts";

declare const __VERSION__: string;
declare const __PROTOCOL__: number;
function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? "") : "";
}
function probeMappedFailure(): never {
  throw new Error("OVE011_SOURCE_MAP_SENTINEL");
}
async function main(): Promise<void> {
  const version = typeof __VERSION__ === "string" ? __VERSION__ : "unbundled-probe";
  const protocol = typeof __PROTOCOL__ === "number" ? __PROTOCOL__ : 0;
  if (argument("expected-protocol") && Number(argument("expected-protocol")) !== protocol) {
    process.exitCode = 30;
    return;
  }
  const mode = argument("mode");
  if (mode === "version") {
    process.stdout.write(
      JSON.stringify({ version, protocol, driver, node: process.versions.node }) + "\n",
    );
    return;
  }
  if (mode === "stack") {
    probeMappedFailure();
  }
  if (mode === "tcc") {
    const text = readFileSync(join(homedir(), "Documents/.overmind-ove011-probe.txt"), "utf8");
    if (text !== "overmind-owned-nonsensitive-probe\n") {
      throw new Error("Unexpected TCC fixture");
    }
    process.stdout.write("own-document-read-ok\n");
    return;
  }
  const directory = argument("dir");
  if (!directory.startsWith("/private/tmp/ove11-") && !directory.startsWith("/tmp/ove11-")) {
    throw new Error("Probe data directory must be a private temporary fixture");
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (mode === "features") {
    process.stdout.write(JSON.stringify(await features(directory, argument("extension"))) + "\n");
    return;
  }
  const db = openDatabase(join(directory, mode === "writer" ? "features.db" : "idle.db"));
  configure(db);
  if (mode === "writer") {
    let id = 1000000;
    const insert = db.prepare("INSERT INTO events VALUES(?, ?, ?, ?)");
    const tick = () => {
      db.exec("BEGIN IMMEDIATE");
      for (let count = 0; count < 100; count++) {
        id++;
        insert.run(id, id, "writer", JSON.stringify({ id, valid: true }));
      }
      db.exec("COMMIT");
    };
    tick();
    const timer = setInterval(tick, 25);
    // Bound the writer even if its parent is killed during a failed probe.
    setTimeout(() => {
      clearInterval(timer);
      db.close();
      process.exit(0);
    }, 10000).unref();
    process.on("SIGTERM", () => {
      clearInterval(timer);
      db.close();
      process.exit(0);
    });
    process.stdout.write("writer-ready\n");
    return;
  }
  if (mode !== "serve") {
    db.close();
    throw new Error("Unknown probe mode");
  }
  const path = join(directory, "engine.sock");
  const server = createServer((socket) => {
    socket.end(JSON.stringify({ version, protocol, driver }));
  });
  server.listen(path, () => {
    chmodSync(path, 0o600);
    process.stdout.write(
      JSON.stringify({ ready: true, pid: process.pid, mode: statSync(path).mode & 0o777 }) + "\n",
    );
  });
  process.on("SIGTERM", () => {
    server.close(() => {
      db.close();
      try {
        unlinkSync(path);
      } catch {
        /* server.close may already unlink */
      }
      process.exit(0);
    });
  });
}
main().catch((error: unknown) => {
  process.stderr.write(
    (error instanceof Error ? (error.stack ?? error.message) : "Probe failed") + "\n",
  );
  process.exitCode = 1;
});
