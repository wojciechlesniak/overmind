import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import { readEvent } from "../ci/context.parse-boundary.ts";
import { installSecurityTool } from "./install.ts";
import { createGitleaksConfig } from "./config.ts";
import { readAllowlist } from "../check-licenses/input.parse-boundary.ts";

const temporary = process.env["RUNNER_TEMP"];
const output = process.env["GITHUB_OUTPUT"];
if (!temporary || !output) {
  throw new Error("CI temporary directory and output are required");
}
const directory = resolve(temporary, "security-tools");
mkdirSync(directory, { recursive: true });
const checksums = [];
for (const name of ["gitleaks", "syft"] as const) {
  const path = await installSecurityTool(name);
  if (name === "syft") {
    continue; // Prewarm the verified cache before network-denied integration tests.
  }
  copyFileSync(path, resolve(directory, name));
  checksums.push(`${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${name}`);
}
const config = await createGitleaksConfig();
if (!config) {
  throw new Error("Verified secret configuration unavailable");
}
try {
  copyFileSync(config.path, resolve(directory, "gitleaks.toml"));
  checksums.push(
    `${createHash("sha256").update(readFileSync(config.path)).digest("hex")}  gitleaks.toml`,
  );
} finally {
  config.dispose();
}
const notice = resolve(import.meta.dirname, "GITLEAKS-LICENSE.txt");
copyFileSync(notice, resolve(directory, "GITLEAKS-LICENSE.txt"));
checksums.push(
  `${createHash("sha256").update(readFileSync(notice)).digest("hex")}  GITLEAKS-LICENSE.txt`,
);
writeFileSync(resolve(directory, "SHA256SUMS"), checksums.join("\n") + "\n");
const event = readEvent();
const base = event.pull_request?.base.sha ?? event.merge_group?.base_sha ?? event.before ?? "";
const head =
  event.pull_request?.head.sha ?? event.merge_group?.head_sha ?? process.env["GITHUB_SHA"] ?? "";
const validSHA = z
  .string()
  .regex(/^[a-f0-9]{40}$/u)
  .parse(head);
const mode = /^[a-f0-9]{40}$/u.test(base) && base !== "0".repeat(40) ? "range" : "all";
const allowlist = z
  .array(z.string().regex(/^[A-Za-z0-9.-]+$/u))
  .parse([...readAllowlist(resolve(import.meta.dirname, "../check-licenses/allowlist.json"))]);
appendFileSync(
  output,
  `base=${base}\nhead=${validSHA}\nmode=${mode}\nlicenses=${allowlist.join(",")}\n`,
);
