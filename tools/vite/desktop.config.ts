import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const proxyFailure = "Development proxy requires a loopback HTTP origin";

export default defineConfig(({ command, isPreview }) => {
  const target = command === "serve" && !isPreview ? process.env["OVERMIND_DEV_PROXY"] : undefined;
  if (target) {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new Error(proxyFailure);
    }
    if (
      !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?\/?$/iu.test(target) ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(proxyFailure);
    }
  }
  return {
    root: fileURLToPath(new URL("../../apps/desktop", import.meta.url)),
    plugins: [react()],
    clearScreen: false,
    envPrefix: ["VITE_OVERMIND_"],
    resolve: { dedupe: ["react", "react-dom"] },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      allowedHosts: ["127.0.0.1", "localhost"],
      cors: false,
      fs: { strict: true },
      watch: { ignored: ["**/src-tauri/**"] },
      ...(target ? { proxy: { "/v1": { target, changeOrigin: false } } } : {}),
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      cors: false,
      allowedHosts: ["127.0.0.1", "localhost"],
    },
    build: {
      outDir: "dist",
      target: "safari18",
      sourcemap: false,
      minify: true,
      cssCodeSplit: true,
      modulePreload: { polyfill: false },
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 800,
    },
  };
});
