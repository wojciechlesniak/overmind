// @vitest-environment node
import { createServer as createHttpServer, request } from "node:http";
import { createConnection, createServer as createTcpServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, preview, resolveConfig, type PreviewServer } from "vite";
import { expect, it, vi } from "vitest";

const root = resolve(import.meta.dirname, "..");
const configuration = resolve(root, "../../tools/vite/desktop.config.ts");
async function unusedPort(): Promise<number> {
  const probe = createTcpServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  const address = probe.address();
  if (!address || typeof address === "string") {
    throw new Error("No ephemeral port");
  }
  await new Promise<void>((done, reject) =>
    probe.close((error) => {
      if (error) {
        reject(error);
      } else {
        done();
      }
    }),
  );
  return address.port;
}
function get(port: number, host: string, path = "/") {
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((accept, reject) => {
    const req = request(
      {
        agent: false,
        hostname: "127.0.0.1",
        port,
        path,
        headers: { Host: host, Origin: "https://evil.example" },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => {
          accept({ status: response.statusCode ?? 0, headers: response.headers, body });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(new Error("request timeout")));
    req.end();
  });
}
it("real server stays on IPv4 loopback and denies hostile Host, CORS and outside files", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", undefined);
  const port = await unusedPort();
  const server = await createServer({ root, configFile: configuration, server: { port } });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("No listening address");
    }
    expect(address.address).toBe("127.0.0.1");
    expect(server.config.server.port).toBe(port);
    expect(server.config.server.strictPort).toBe(true);
    const allowed = await get(address.port, "127.0.0.1");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBeUndefined();
    const outside = mkdtempSync(resolve(tmpdir(), "overmind-outside-vite-"));
    try {
      const path = resolve(outside, "private.txt");
      writeFileSync(path, "outside workspace fixture");
      expect((await get(address.port, "127.0.0.1", `/@fs${path}`)).status).toBe(403);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    const hostile = await get(address.port, "evil.example");
    expect(hostile.status).toBe(403);
    expect(hostile.headers["access-control-allow-origin"]).toBeUndefined();
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((item) => item?.family === "IPv4" && !item.internal)?.address;
    if (lan) {
      const accepted = await new Promise<boolean>((done) => {
        const socket = createConnection({ host: lan, port: address.port });
        socket.once("connect", () => {
          socket.destroy();
          done(true);
        });
        socket.once("error", () => {
          socket.destroy();
          done(false);
        });
        socket.setTimeout(1000, () => {
          socket.destroy();
          done(false);
        });
      });
      expect(accepted).toBe(false);
    }
  } finally {
    await server.close();
  }
}, 30000);
it("proxy is loopback-only, preserves Host and is absent from production configuration", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", "http://127.0.0.1:7878");
  const dev = await resolveConfig({ root, configFile: configuration }, "serve");
  expect(dev.server.port).toBe(5173);
  expect(dev.server.host).toBe("127.0.0.1");
  expect(dev.server.proxy?.["/v1"]).toEqual({
    target: "http://127.0.0.1:7878",
    changeOrigin: false,
  });
  const prod = await resolveConfig({ root, configFile: configuration }, "build");
  expect(prod.server.proxy).toBeUndefined();
  for (const target of [
    "https://example.invalid",
    "http://user:pass@127.0.0.1:7878",
    "http://127.0.0.1:7878/v1",
  ]) {
    vi.stubEnv("OVERMIND_DEV_PROXY", target);
    await expect(resolveConfig({ root, configFile: configuration }, "serve")).rejects.toThrow(
      "loopback HTTP origin",
    );
  }
}, 30000);

it("real development proxy preserves incoming Host and blocks hostile requests before forwarding", async () => {
  const hosts: (string | undefined)[] = [];
  const upstream = createHttpServer((req, res) => {
    hosts.push(req.headers.host);
    res.end("ok");
  });
  await new Promise<void>((done) => upstream.listen(0, "127.0.0.1", done));
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("No upstream address");
  }
  vi.stubEnv("OVERMIND_DEV_PROXY", `http://127.0.0.1:${String(upstreamAddress.port)}`);
  const port = await unusedPort();
  const server = await createServer({ root, configFile: configuration, server: { port } });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("No proxy address");
    }
    expect((await get(address.port, "localhost", "/v1/health")).status).toBe(200);
    expect(hosts).toEqual(["localhost"]);
    expect((await get(address.port, "evil.example", "/v1/health")).status).toBe(403);
    expect(hosts).toEqual(["localhost"]);
  } finally {
    await server.close();
    await new Promise<void>((done, reject) =>
      upstream.close((error) => {
        if (error) {
          reject(error);
        } else {
          done();
        }
      }),
    );
  }
}, 30000);

it("strictPort refuses an occupied port rather than choosing another", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", undefined);
  const occupied = createTcpServer();
  await new Promise<void>((done) => occupied.listen(0, "127.0.0.1", done));
  const address = occupied.address();
  if (!address || typeof address === "string") {
    throw new Error("No occupied port");
  }
  const server = await createServer({
    root,
    configFile: configuration,
    server: { port: address.port },
  });
  try {
    await expect(server.listen()).rejects.toThrow();
  } finally {
    await server.close();
    await new Promise<void>((done, reject) =>
      occupied.close((error) => {
        if (error) {
          reject(error);
        } else {
          done();
        }
      }),
    );
  }
}, 10000);

it("preview never consumes the development proxy", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", "https://must-not-be-consumed.invalid");
  const configurationForPreview = await resolveConfig(
    { root, configFile: configuration },
    "serve",
    "production",
    "production",
    true,
  );
  expect(configurationForPreview.preview.host).toBe("127.0.0.1");
  expect(configurationForPreview.preview.port).toBe(4173);
  expect(configurationForPreview.preview.strictPort).toBe(true);
  expect(configurationForPreview.server.proxy).toBeUndefined();
  expect(configurationForPreview.preview.proxy).toBeUndefined();
}, 10000);

it.each([
  "http://127.1:7878",
  "http://2130706433:7878",
  "http://0x7f000001:7878",
  "http://127.0.0.1:7878?",
  "http://127.0.0.1:7878#",
  "http://127.0.0.1:99999",
  "not-an-origin",
])("rejects a non-origin proxy target %#", async (target) => {
  vi.stubEnv("OVERMIND_DEV_PROXY", target);
  const outcome = await resolveConfig({ root, configFile: configuration }, "serve").then(
    () => "accepted",
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Development proxy requires a loopback HTTP origin"
        ? "denied"
        : "unexpected-error",
  );
  expect(outcome).toBe("denied");
});

function closePreview(server: PreviewServer): Promise<void> {
  return new Promise((done, reject) => {
    server.httpServer.close((error) => {
      if (error) {
        reject(error);
      } else {
        done();
      }
    });
  });
}
it("real production preview stays on loopback and denies hostile Host, CORS and outside files", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", "https://must-not-be-consumed.invalid");
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-vite-preview-"));
  const output = resolve(directory, "bundle");
  mkdirSync(output);
  writeFileSync(resolve(output, "index.html"), "<!doctype html><title>Preview fixture</title>");
  const privateFile = resolve(directory, "outside.txt");
  writeFileSync(privateFile, "outside-preview-fixture");
  let server: PreviewServer | undefined;
  try {
    const port = await unusedPort();
    server = await preview({
      root,
      configFile: configuration,
      build: { outDir: output },
      preview: { port },
    });
    const address = server.httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("No preview address");
    }
    expect(address.address).toBe("127.0.0.1");
    expect(address.port).toBe(port);
    expect(server.config.preview.strictPort).toBe(true);
    expect(server.config.preview.proxy).toBeUndefined();
    const allowed = await get(address.port, "127.0.0.1");
    expect(allowed.status).toBe(200);
    expect(allowed.body).toContain("Preview fixture");
    expect(allowed.headers["access-control-allow-origin"]).toBeUndefined();
    const hostile = await get(address.port, "evil.example");
    expect(hostile.status).toBe(403);
    expect(hostile.headers["access-control-allow-origin"]).toBeUndefined();
    const outside = await get(address.port, "127.0.0.1", `/@fs${privateFile}`);
    expect(outside.body).not.toContain("outside-preview-fixture");
  } finally {
    if (server) {
      await closePreview(server);
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
it("production preview refuses an occupied port instead of selecting another", async () => {
  vi.stubEnv("OVERMIND_DEV_PROXY", undefined);
  const directory = mkdtempSync(resolve(tmpdir(), "overmind-preview-busy-"));
  writeFileSync(
    resolve(directory, "index.html"),
    "<!doctype html><title>Busy preview fixture</title>",
  );
  const occupied = createTcpServer();
  let unexpected: PreviewServer | undefined;
  try {
    await new Promise<void>((done, reject) => {
      occupied.once("error", reject);
      occupied.listen(0, "127.0.0.1", done);
    });
    const address = occupied.address();
    if (!address || typeof address === "string") {
      throw new Error("No occupied preview port");
    }
    await expect(
      preview({
        root,
        configFile: configuration,
        build: { outDir: directory },
        preview: { port: address.port },
      }).then((started) => {
        unexpected = started;
        return started;
      }),
    ).rejects.toThrow(/already in use/u);
  } finally {
    if (unexpected) {
      await closePreview(unexpected);
    }
    if (occupied.listening) {
      await new Promise<void>((done, reject) =>
        occupied.close((error) => {
          if (error) {
            reject(error);
          } else {
            done();
          }
        }),
      );
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 10000);
