import { expect, it } from "vitest";
import { z } from "zod";
import { fromThrown } from "./app-error.ts";

it("classifies foreign failures without serializing their original content", () => {
  const abort = new Error("foreign cancellation detail");
  abort.name = "AbortError";
  for (const [value, code] of [
    [new Error("foreign detail"), "internal.unexpected"],
    ["foreign detail", "internal.unexpected"],
    [{ message: "foreign detail" }, "internal.unexpected"],
    [abort, "internal.cancelled"],
    [new SyntaxError("foreign detail"), "validation.malformed_json"],
  ] as const) {
    const error = fromThrown(value);
    expect(error.code).toBe(code);
    expect(error.cause).toBe(value);
    expect(JSON.stringify(error)).not.toContain("foreign");
  }
  const schema = z.strictObject({ value: z.number() });
  const invalid = schema.safeParse({ value: "wrong" });
  if (!invalid.success) {
    expect(fromThrown(invalid.error).code).toBe("validation.invalid_input");
  }
});

it("does not inspect hostile properties and bounds validation issues", () => {
  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("foreign detail");
      },
    },
  );
  expect(fromThrown(hostile).code).toBe("internal.unexpected");
  const issues = Array.from({ length: 25 }, () => ({
    code: "custom" as const,
    path: ["private_table"],
    message: "foreign detail",
  }));
  const error = fromThrown(new z.ZodError(issues));
  expect(error.details?.["truncated"]).toBe(true);
  expect(error.details?.["issues"]).toHaveLength(20);
  expect(JSON.stringify(error)).not.toContain("private_table");
  expect(fromThrown(null, "validation.malformed_json").code).toBe("validation.malformed_json");
});
