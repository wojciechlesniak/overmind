import { spawn } from "node:child_process";
import process from "node:process";
const [, , executable, directory] = process.argv;
if (!executable || !directory) {
  throw new Error("Missing detached fixture arguments");
}
const child = spawn(executable, ["--mode", "serve", "--dir", directory], {
  detached: true,
  stdio: "ignore",
});
child.unref();
process.stdout.write(JSON.stringify({ pid: child.pid }) + "\n");
