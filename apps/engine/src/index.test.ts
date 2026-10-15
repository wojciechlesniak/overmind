import { it, expect } from "vitest";
it("loads in the correct environment with deterministic timezone", async () => {
  await import("./index.ts");
  expect(process.env["TZ"]).toBe("UTC");
  expect(typeof document).toBe("undefined");
});
