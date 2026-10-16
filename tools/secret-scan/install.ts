import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { install } from "../pinned-bin/install.ts";

export function installSecurityTool(name: "gitleaks" | "syft") {
  return install(name, { lockFile: resolve(import.meta.dirname, `${name}.lock.json`) });
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? "gitleaks";
  if (name === "all") {
    const { createGitleaksConfig } = await import("./config.ts");
    const config = await createGitleaksConfig();
    config?.dispose();
    for (const tool of ["gitleaks", "syft"] as const) {
      console.log(await installSecurityTool(tool));
    }
  } else {
    if (name !== "gitleaks" && name !== "syft") {
      throw new Error("Unknown security tool");
    }
    console.log(await installSecurityTool(name));
  }
}
