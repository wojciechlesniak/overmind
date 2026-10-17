import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { extractLinks } from "./markdown.ts";
import { diagnostic, type Diagnostic } from "./policy.ts";
export interface ExternalPort {
  resolve: (host: string, signal: AbortSignal) => Promise<string[]>;
  request: (
    url: URL,
    address: string,
    method: "HEAD" | "GET",
    signal: AbortSignal,
  ) => Promise<number>;
}
// Conservatively support global IPv4 only; IPv6-only hosts produce a warning.
// This avoids accepting mapped, transition or special-purpose IPv6 ranges.
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) !== 4) {
    return false;
  }
  const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

const publicNetwork: ExternalPort = {
  resolve: async (host, signal) => {
    signal.throwIfAborted();
    if (isIP(host)) {
      return [host];
    }
    return (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
  },
  request: (url, address, method, signal) =>
    new Promise((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = send(
        url,
        {
          method,
          signal,
          agent: false,
          headers: { "User-Agent": "Overmind-docs-check", Accept: "*/*" },
          lookup: (_host, options, callback) => {
            if (options.all) {
              callback(null, [{ address, family: 4 }]);
            } else {
              callback(null, address, 4);
            }
          },
        },
        (response) => {
          resolve(response.statusCode ?? 0);
          response.destroy();
        },
      );
      req.on("error", reject);
      req.end();
    }),
};

async function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(new Error("External check timed out."));
    };
    signal.addEventListener("abort", abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", abort);
      })
      .catch(() => undefined);
  });
}

export async function checkExternalLinks(
  files: ReadonlyMap<string, string>,
  port: ExternalPort = publicNetwork,
): Promise<Diagnostic[]> {
  const queue = [...files].flatMap(([file, md]) =>
    extractLinks(md)
      .filter((link) => /^https?:/iu.test(link.target))
      .map((link) => ({ ...link, file })),
  );
  const errors: Diagnostic[] = [];
  let next = 0;
  const worker = async () => {
    for (;;) {
      const link = queue[next++];
      if (!link) {
        return;
      }
      try {
        const url = new URL(link.target);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          (url.port && !["80", "443"].includes(url.port))
        ) {
          throw new Error("Unsafe URL.");
        }
        const signal = AbortSignal.timeout(10_000);
        const addresses = await bounded(port.resolve(url.hostname, signal), signal);
        if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
          throw new Error("Non-public address.");
        }
        const address = addresses[0];
        if (!address) {
          throw new Error("No public address.");
        }
        let status = await bounded(port.request(url, address, "HEAD", signal), signal);
        if (status === 405 || status === 501) {
          status = await bounded(port.request(url, address, "GET", signal), signal);
        }
        if (status < 200 || status >= 300) {
          throw new Error("Unreachable or redirected URL.");
        }
      } catch {
        errors.push(
          diagnostic(
            link.file,
            link.line,
            "external-link",
            "Public URL reachability could not be confirmed; redirects and unsafe addresses are not followed.",
            "warning",
          ),
        );
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return errors;
}
