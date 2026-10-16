import { build } from "bun";
import process from "node:process";
import { resolve } from "node:path";
const [, , entry, executable] = process.argv;
if (!entry || !executable) {
  throw new Error("Missing Bun build arguments");
}
const result = await build({
  entrypoints: [entry],
  target: "bun",
  compile: { target: "bun-darwin-arm64", outfile: executable },
  sourcemap: "inline",
  minify: false,
  define: { __VERSION__: '"0.0.0-ove011"', __PROTOCOL__: "1" },
  plugins: [
    {
      name: "bun-probe-driver",
      setup(plugin) {
        plugin.onResolve({ filter: /^\.\/driver-default\.ts$/ }, () => ({
          path: resolve(import.meta.dirname, "driver-bun.ts"),
        }));
      },
    },
  ],
});
if (!result.success) {
  throw new AggregateError(result.logs, "Bun compile failed");
}
