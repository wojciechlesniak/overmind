import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePinnedAsset } from "../pinned-bin/lock.parse-boundary.ts";

export function readDefaultConfigPin() {
  const value: unknown = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "default-config.lock.json"), "utf8"),
  );
  return parsePinnedAsset(value);
}
