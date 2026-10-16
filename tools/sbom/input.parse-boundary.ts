import { lstatSync, readFileSync } from "node:fs";
import { z } from "zod";
const property = z.object({ name: z.string(), value: z.string() });
const license = z.union([
  z.object({ expression: z.string().min(1) }),
  z.object({
    license: z
      .object({ id: z.string().min(1).optional(), name: z.string().min(1).optional() })
      .loose()
      .refine((item) => Boolean(item.id ?? item.name)),
  }),
]);
const component = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    purl: z.string().regex(/^pkg:(?:npm|cargo)\//u),
    licenses: z.array(license).optional(),
    properties: z.array(property).optional(),
  })
  .loose();
const document = z
  .object({
    bomFormat: z.literal("CycloneDX"),
    specVersion: z.literal("1.6"),
    components: z.array(component).nonempty(),
  })
  .loose();
export type SBOM = z.infer<typeof document>;
export interface WorkspaceIdentity {
  version: string;
  sha: string;
}
export function desktopWorkspaceIdentity(lock: string, sha: string): WorkspaceIdentity | undefined {
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw new Error("Invalid workspace source commit");
  }
  const sections = lock
    .split(/^\[\[package\]\]$/mu)
    .filter((part) => /^name = "overmind-desktop"$/mu.test(part));
  if (!sections.length) {
    return undefined;
  }
  // Accept only Cargo's generated local stanza; registry/git entries and broader
  // TOML syntax are not guessed into a first-party identity.
  const stanza =
    /^\s*name = "overmind-desktop"\nversion = "(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.+-]+)?)"\n(?:dependencies = \[\n(?: "[A-Za-z0-9_. +-]+",\n)*\]\n)?\s*$/u;
  const version = sections.length === 1 ? stanza.exec(sections[0] ?? "")?.[1] : undefined;
  if (!version) {
    throw new Error("Unsupported desktop workspace lockfile identity");
  }
  return { version, sha };
}
function purlComponent(value: string): string {
  // PURL clause 5.4 preserves colons even inside a qualifier value.
  return encodeURIComponent(value).replaceAll("%3A", ":");
}
function identifyWorkspace(raw: unknown, workspace: WorkspaceIdentity): unknown {
  const input = z
    .object({ components: z.array(z.unknown()) })
    .loose()
    .parse(raw);
  const local = z
    .object({
      name: z.literal("overmind-desktop"),
      version: z.literal(workspace.version),
      purl: z.undefined().optional(),
      properties: z.array(property),
    })
    .loose();
  return {
    ...input,
    components: input.components.map((value) => {
      const result = local.safeParse(value);
      if (!result.success) {
        return value;
      }
      const item = result.data;
      const has = (name: string, value: string) =>
        item.properties.some((entry) => entry.name === name && entry.value === value);
      if (
        !has("syft:package:foundBy", "rust-cargo-lock-cataloger") ||
        !has("syft:package:metadataType", "rust-cargo-lock-entry") ||
        !has("syft:location:0:path", "/apps/desktop/src-tauri/Cargo.lock")
      ) {
        return value;
      }
      const source = `git+https://github.com/wojciechlesniak/overmind@${workspace.sha}`;
      return {
        ...item,
        purl: `pkg:cargo/overmind-desktop@${purlComponent(workspace.version)}?vcs_url=${purlComponent(source)}#apps/desktop/src-tauri`,
        properties: [...item.properties, { name: "overmind:workspace-source", value: source }],
      };
    }),
  };
}
export function parseSBOM(raw: unknown, workspace?: WorkspaceIdentity): SBOM {
  return document.parse(workspace ? identifyWorkspace(raw, workspace) : raw);
}
export function readSBOM(path: string, workspace?: WorkspaceIdentity): SBOM {
  const file = lstatSync(path);
  if (!file.isFile() || file.size > 64 * 1024 * 1024) {
    throw new Error("SBOM must be a bounded regular file");
  }
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parseSBOM(raw, workspace);
}
