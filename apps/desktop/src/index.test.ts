import { it, expect } from "vitest";
it("loads in the correct environment with deterministic timezone", async () => {
  await import("./index.ts");
  expect(process.env["TZ"]).toBe("UTC");
  expect(typeof document).toBe("object");
});
it("provides DOM matchers and deterministic browser APIs", () => {
  const element = document.createElement("div");
  document.body.append(element);
  expect(element).toBeInTheDocument();
  expect(window.matchMedia("(min-width: 1px)").matches).toBe(false);
  const observer = new ResizeObserver(() => {
    /* No layout events are emitted by the fixture. */
  });
  expect(() => {
    observer.observe(element);
  }).not.toThrow();
  element.remove();
});
