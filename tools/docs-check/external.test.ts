import { expect, it, vi } from "vitest";
import { checkExternalLinks, isPublicAddress, type ExternalPort } from "./external.ts";

it("rejects private, mapped and reserved addresses and mixed DNS answers before requests", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "::1",
    "::ffff:8.8.8.8",
  ]) {
    expect(isPublicAddress(ip)).toBe(false);
  }
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  const request = vi.fn<ExternalPort["request"]>().mockResolvedValue(200);
  const result = await checkExternalLinks(
    new Map([["README.md", "# Root\n\n[link](https://public.example/a)\n"]]),
    { resolve: () => Promise.resolve(["8.8.8.8", "127.0.0.1"]), request },
  );
  expect(result.map((d) => d.rule)).toEqual(["external-link"]);
  expect(request).not.toHaveBeenCalled();
});

it("pins a public resolved IP, falls back from HEAD to GET and never follows redirects", async () => {
  const request = vi
    .fn<ExternalPort["request"]>()
    .mockResolvedValueOnce(405)
    .mockResolvedValueOnce(200)
    .mockResolvedValueOnce(302);
  const files = new Map([
    ["README.md", "# Root\n\n[a](https://public.example/a)\n[b](https://public.example/b)\n"],
  ]);
  const result = await checkExternalLinks(files, {
    resolve: () => Promise.resolve(["8.8.8.8"]),
    request,
  });
  expect(request.mock.calls.every((call) => call[1] === "8.8.8.8")).toBe(true);
  expect(request.mock.calls.map((call) => call[2]).sort()).toEqual(["GET", "HEAD", "HEAD"]);
  expect(result).toHaveLength(1);
  expect(result[0]?.severity).toBe("warning");
});

it("bounds unresolved DNS with a ten-second deadline and never sends a request after abort", async () => {
  const controller = new AbortController();
  const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const request = vi.fn<ExternalPort["request"]>();
  try {
    const checked = checkExternalLinks(
      new Map([["README.md", "# Root\n\n[link](https://public.example/a)\n"]]),
      { resolve: () => new Promise<string[]>(() => undefined), request },
    );
    controller.abort();
    expect((await checked)[0]?.severity).toBe("warning");
    expect(deadline).toHaveBeenCalledWith(10_000);
    expect(request).not.toHaveBeenCalled();
  } finally {
    deadline.mockRestore();
  }
});
