import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { installResource } from "../pinned-bin/install.ts";
import { readDefaultConfigPin } from "./config.parse-boundary.ts";

export function compileGitleaksConfig(defaultSource: string, policy: string): string {
  const extension = /^\[extend\]\r?\nuseDefault = true\r?\n/mu;
  if (!extension.test(policy)) {
    throw new Error("Secret policy must extend the pinned default rules");
  }
  const firstRule = defaultSource.search(/^\[\[rules\]\]$/mu);
  if (firstRule < 0) {
    throw new Error("Default secret rules are missing");
  }
  // Upstream also accepts a second BEGIN header as the terminator. Require END
  // so separate documentation examples cannot be joined into a synthetic key.
  const originalPEM = "PRIVATE KEY(?: BLOCK)?-----[\\s\\S-]{64,}?KEY(?: BLOCK)?-----";
  const completePEM =
    "PRIVATE KEY(?: BLOCK)?-----[\\s\\S-]{64,}?-----END[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----";
  const rules = defaultSource.slice(firstRule).replace(originalPEM, completePEM);
  if (/^\[(?:\[?allowlists?\]?|extend)\]/mu.test(rules)) {
    throw new Error("Unexpected global exclusions in default rules");
  }
  // Gitleaks appends inherited global allowlists unconditionally. Compile the
  // pinned rules explicitly so only our fixture-path AND marker exemption applies.
  return `${policy.replace(extension, "")}\n${rules}`;
}

export async function createGitleaksConfig(offline = false) {
  const source = await installResource("gitleaks-default-config", readDefaultConfigPin(), {
    offline,
  });
  if (!source) {
    return undefined;
  }
  const text = compileGitleaksConfig(
    readFileSync(source, "utf8"),
    readFileSync(resolve(import.meta.dirname, "../../.gitleaks.toml"), "utf8"),
  );
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-gitleaks-config-"));
  const path = resolve(directory, "gitleaks.toml");
  try {
    writeFileSync(path, text, { flag: "wx", mode: 0o600 });
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    path,
    dispose: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
