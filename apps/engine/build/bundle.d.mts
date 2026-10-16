import type { BuildResult, Metafile } from "esbuild";
export function guardMetafile(
  metafile: Metafile,
  dependencies: Record<string, string>,
  root: string,
): void;
export function bundleEngine(options?: {
  root?: string;
  outfile?: string;
}): Promise<BuildResult<{ metafile: true; write: false }>>;
