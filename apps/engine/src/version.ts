declare const __OVERMIND_VERSION__: string;
declare const __PROTOCOL_VERSION__: number;
declare const __BUILD_SHA__: string;

export function versionInfo() {
  return {
    version: typeof __OVERMIND_VERSION__ === "undefined" ? "0.0.0-dev" : __OVERMIND_VERSION__,
    protocol: typeof __PROTOCOL_VERSION__ === "undefined" ? 1 : __PROTOCOL_VERSION__,
    buildSha: typeof __BUILD_SHA__ === "undefined" ? "dev" : __BUILD_SHA__,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  };
}
