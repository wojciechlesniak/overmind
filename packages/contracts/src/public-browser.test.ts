import { expect, it } from "vitest";
import { build } from "vite";

it("bundles the actual contracts public API for browsers without Node dependencies", async () => {
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: new URL("./index.ts", import.meta.url).pathname, formats: ["es"] },
      rollupOptions: {
        onwarn(warning) {
          // Zod 4.6.6 has PURE comments and internal cycles; external imports still fail below.
          if (
            (warning.code === "INVALID_ANNOTATION" && warning.id?.includes("/node_modules/zod/")) ||
            (warning.code === "CIRCULAR_DEPENDENCY" &&
              warning.ids?.length &&
              warning.ids.every((id) => id.includes("/node_modules/zod/")))
          ) {
            return;
          }
          throw new Error(warning.message);
        },
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap((output) => ("output" in output ? output.output : []));
  expect(chunks.length).toBeGreaterThan(0);
  for (const chunk of chunks) {
    if (chunk.type === "chunk") {
      expect([...chunk.imports, ...chunk.dynamicImports]).toEqual([]);
    }
  }
  const code = chunks.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
  expect(code).toContain("fromThrown");
  expect(code).not.toContain("__vite-browser-external");
  expect(code).not.toMatch(/from\s+["'](?:node:|fs["']|child_process["'])/u);
});
