import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

// Trusted test harness: perform real filesystem changes at the external I/O boundary.
const target = process.env.OVE017_INPUT_TARGET;
const mutation = process.env.OVE017_INPUT_MUTATION;
const receipt = process.env.OVE017_INPUT_RECEIPT;
const limit = Number(process.env.OVE017_INPUT_LIMIT);
const original = {
  openSync: fs.openSync,
  fstatSync: fs.fstatSync,
  readSync: fs.readSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
};
let descriptor;
let mutated = false;
let bytesRead = 0;
function change() {
  if (mutated) {
    return;
  }
  mutated = true;
  if (mutation.startsWith("grow")) {
    fs.appendFileSync(target, " ".repeat(limit + 1));
  } else {
    const replacement = `${target}.replacement`;
    original.writeFileSync(replacement, original.readFileSync(target));
    fs.renameSync(replacement, target);
  }
}
fs.openSync = (...args) => {
  const result = original.openSync(...args);
  if (args[0] === target) {
    descriptor = result;
  }
  return result;
};
fs.fstatSync = (...args) => {
  const result = original.fstatSync(...args);
  if (args[0] === descriptor && mutation.endsWith("metadata")) {
    change();
  }
  return result;
};
fs.readSync = (...args) => {
  const result = original.readSync(...args);
  if (args[0] === descriptor) {
    bytesRead += result;
    if (mutation.endsWith("read")) {
      change();
    }
  }
  return result;
};
fs.readFileSync = (...args) => {
  const result = original.readFileSync(...args);
  if (args[0] === descriptor || args[0] === target) {
    bytesRead += Buffer.byteLength(result);
    if (mutation.endsWith("read")) {
      change();
    }
  }
  return result;
};
process.on("exit", () => {
  original.writeFileSync(receipt, JSON.stringify({ mutated, bytesRead }));
});
syncBuiltinESMExports();
