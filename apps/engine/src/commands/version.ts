import { stdout } from "../cli.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { versionInfo } from "../version.ts";

export function version(json: boolean): number {
  const info = versionInfo();
  stdout(
    json
      ? `${JSON.stringify(info)}\n`
      : `overmind-engine ${info.version} (protocol ${String(info.protocol)}, ${info.buildSha})\n`,
  );
  return EXIT_CODES.ok;
}
