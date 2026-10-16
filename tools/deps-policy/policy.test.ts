import { expect, it } from "vitest";
import { checkRules, type PolicyInput } from "./policy.ts";
import { parseRegister, type RegisterEntry } from "./register.ts";
import { parseTauriVersion } from "./input.parse-boundary.ts";

function fixture(): PolicyInput {
  const catalog = {
    typescript: "6.0.3",
    "typescript-eslint": "8.71.1",
    react: "19.3.0",
    "react-dom": "19.3.0",
    vitest: "5.0.4",
    "@vitest/coverage-v8": "5.0.4",
    storybook: "10.6.2",
    "@storybook/addon-a11y": "10.6.2",
    zod: "4.6.6",
    "@tauri-apps/api": "2.12.3",
  };
  return {
    catalog,
    binaries: {},
    manifests: [
      {
        name: "@overmind/contracts",
        private: true,
        dependencies: { zod: "catalog:" },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      },
      {
        name: "overmind",
        private: true,
        dependencies: { react: "catalog:" },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      },
    ],
    entries: new Map(
      Object.entries(catalog).map(([name, version]) => [
        name,
        {
          name,
          fields: {
            Version: version,
            License: "MIT",
            ...(name === "zod" ? { "Pure layer": "pure-layer-ok" } : {}),
          },
        },
      ]),
    ),
    matrix: new Map(Object.entries(catalog)),
    verified: "2026-10-16",
    today: "2026-10-16",
    installed: {
      typescript: "6.0.3",
      typescriptEslint: "8.71.1",
      typescriptPeer: ">=4.8.4 <6.1.0",
    },
    justifications: [],
    allowedLicenses: new Set(["MIT"]),
    exceptions: [],
  };
}
function setPin(input: PolicyInput, name: string, version: string) {
  input.catalog[name] = version;
  input.entries = new Map(
    [...input.entries].map(([key, entry]) => [
      key,
      key === name ? { ...entry, fields: { ...entry.fields, Version: version } } : entry,
    ]),
  );
  input.matrix = new Map(
    [...input.matrix].map(([key, value]) => [key, key === name ? version : value]),
  );
}
it("accepts exact catalog pins and explicit pure-layer zod; stale verification only warns", () => {
  const input = fixture();
  expect(checkRules(input)).toEqual([]);
  input.today = "2027-01-16";
  expect(checkRules(input)).toMatchObject([{ rule: "date", level: "warning" }]);
});
it.each([
  "^19",
  "https://example.invalid/package.tgz",
  "git+https://example.invalid/repo",
  "file:../../outside",
  "npm:alias@1.0.0",
  "workspace:*",
])("rejects external non-catalog specifier %s", (specifier) => {
  const input = fixture();
  const manifest = input.manifests[0];
  if (!manifest) {
    throw new Error("Invalid fixture");
  }
  manifest.dependencies["react"] = specifier;
  expect(checkRules(input).some((item) => item.rule === "specifier")).toBe(true);
});
it("rejects a range pin, missing register, mismatched matrix and denied license independently", () => {
  for (const rule of ["pin", "register", "matrix", "license"]) {
    const input = fixture();
    if (rule === "pin") {
      setPin(input, "react", "^19");
    }
    if (rule === "register") {
      const entries = new Map(input.entries);
      entries.delete("react");
      input.entries = entries;
    }
    if (rule === "matrix") {
      input.matrix = new Map([...input.matrix, ["react", "19.2.0"]]);
    }
    if (rule === "license") {
      const entries = new Map(input.entries);
      entries.set("react", {
        name: "react",
        fields: { Version: "19.3.0", License: "GPL-3.0-only" },
      });
      input.entries = entries;
    }
    expect(
      checkRules(input).some((item) => item.rule === (rule === "matrix" ? "register" : rule)),
    ).toBe(true);
  }
});
it("rejects TypeScript7 through the actual supplied peer range even when all register versions agree", () => {
  const input = fixture();
  setPin(input, "typescript", "7.0.2");
  input.installed.typescript = "7.0.2";
  expect(checkRules(input)).toMatchObject([{ rule: "typescript", subject: "typescript" }]);
  input.installed.typescriptPeer = "not a semver range";
  expect(checkRules(input).some((item) => item.rule === "typescript")).toBe(true);
});
it.each([
  ["@vitest/coverage-v8", "5.0.5"],
  ["@storybook/addon-a11y", "10.6.3"],
  ["react-dom", "19.3.1"],
])("rejects coordinated version drift for %s", (name, version) => {
  const input = fixture();
  setPin(input, name, version);
  expect(checkRules(input).some((item) => item.rule === "group")).toBe(true);
});
it("denies unapproved pure-layer dependencies, public workspaces, missing installed pins and Tauri minor drift", () => {
  const input = fixture();
  const manifest = input.manifests[0];
  if (!manifest) {
    throw new Error("Invalid fixture");
  }
  manifest.dependencies["react"] = "catalog:";
  manifest.private = false;
  input.installed.typescriptEslint = "8.71.2";
  input.tauriVersion = "2.13.0";
  expect(new Set(checkRules(input).map((item) => item.rule))).toEqual(
    new Set(["pure-layer", "confusion", "typescript", "tauri"]),
  );
});
it("requires a specific justification for every override, patch and executable dependency build", () => {
  const input = fixture();
  input.justifications = [
    "pnpm.overrides.react",
    "patchedDependencies.react@19.3.0",
    "allowBuilds.esbuild",
  ];
  expect(checkRules(input).filter((item) => item.rule === "justification")).toHaveLength(3);
  const entries = new Map(input.entries);
  for (const key of input.justifications) {
    entries.set(`policy:${key}`, {
      name: `policy:${key}`,
      fields: {
        Justifies: key,
        Value: "Explicit reviewed fixture justification for this exact policy key.",
      },
    });
  }
  input.entries = entries;
  expect(checkRules(input)).toEqual([]);
});
it("does not let binary names overwrite a conflicting catalog version", () => {
  const input = fixture();
  input.binaries = { react: "0.0.1" };
  expect(checkRules(input).some((item) => item.rule === "register")).toBe(true);
});

function register(entry: RegisterEntry): string {
  return (
    `### ${entry.name}\n\n` +
    Object.entries(entry.fields)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n")
  );
}
const block: RegisterEntry = {
  name: "zod",
  fields: {
    Version: "4.6.6",
    License: "MIT",
    "Used by": "contracts",
    "Added by": "OVE_SETUP001",
    Value: "Validated contracts",
    "Maintenance cost": "Review upstream releases",
    "Alternatives considered": "Manual validation",
    Risk: "No install scripts",
    "Last reviewed": "2026-10-16",
    "Pure layer": "pure-layer-ok",
  },
};
const source = () =>
  `Verified on: 2026-10-16\n\n## Compatibility matrix\n\n| Package | Pinned | Latest |\n| --- | --- | --- |\n| zod | 4.6.6 | 4.6.7 |\n\n## Register\n\n${register(block)}\n`;
it("parses snapshot-free Markdown blocks, inline code and wrapped fields", () => {
  const parsed = parseRegister(
    source().replace("Value: Validated contracts", "Value: `Validated`\n  contracts"),
  );
  expect(parsed.entries.get("zod")?.fields["Value"]).toBe("Validated contracts");
  expect(parsed.matrix.get("zod")).toBe("4.6.6");
});
it.each([
  (text: string) => text + register(block),
  (text: string) => text.replace("- Risk: No install scripts", ""),
  (text: string) => text.replace("- License: MIT", "- License: MIT\n- License: ISC"),
  (text: string) => text.replace("Verified on: 2026-10-16", ""),
  (text: string) => text.replace("OVE_SETUP001", "bad task"),
  (text: string) => text.replace("Verified on: 2026-10-16", "Verified on: 2026-02-31"),
  (text: string) => text.replace("Last reviewed: 2026-10-16", "Last reviewed: 2027-10-16"),
  (text: string) =>
    text.replace("| zod | 4.6.6 | 4.6.7 |", "| zod | 4.6.6 | 4.6.7 |\n| zod | 4.6.6 | 4.6.7 |"),
])("fails closed on malformed or duplicate register evidence %#", (alter) => {
  expect(() => parseRegister(alter(source()))).toThrow();
});
it.each([
  '[dependencies]\ntauri = "=2.12.3"\n',
  '[dependencies]\ntauri = { version = "=2.12.3", features = [] }\n',
])("reads exact Tauri pins from supported Cargo forms %#", (text) => {
  expect(parseTauriVersion(text)).toBe("2.12.3");
});
it.each([
  '[dependencies]\ntauri = "^2"\n',
  '[dependencies]\ntauri = "2.12.3"\n',
  '[dependencies]\ntauri = { version = "2.12.3" }\n',
  '[dependencies]\nother = "1.0.0"\n',
  '[dependencies]\ntauri = { version = "^2.13", fake-version = "=2.12.3" }\n',
  '[dependencies]\ntauri = { fake-version = "=2.12.3" }\n',
  '[dependencies]\ntauri = { version = "=2.12.3", git = "https://example.invalid/repo" }\n',
])("fails closed on unsupported Cargo pin forms %#", (text) => {
  expect(() => parseTauriVersion(text)).toThrow();
});
