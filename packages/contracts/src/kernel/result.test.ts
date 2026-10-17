import { expect, expectTypeOf, it } from "vitest";
import {
  andThen,
  combine,
  err,
  map,
  mapErr,
  match,
  ok,
  okVoid,
  tryAsync,
  unwrapOr,
} from "./result.ts";
import type { Result } from "./result.ts";
import { assertNever } from "./result.ts";
import { fromThrown } from "./app-error.ts";

it("carries success and failure through the public Result helpers", async () => {
  const result = andThen(
    map(ok(2), (n) => n * 3),
    (n) => ok(String(n)),
  );
  expect(match(result, { ok: (value) => value, err: () => "failed" })).toBe("6");
  expect(
    unwrapOr(
      map(err("denied"), () => 0),
      9,
    ),
  ).toBe(9);
  expect(mapErr(err("denied"), (reason) => reason.length)).toEqual({ ok: false, error: 6 });
  expect(mapErr(ok(4), () => "changed")).toEqual({ ok: true, value: 4 });
  expect(andThen(err("denied"), () => ok(7))).toEqual({ ok: false, error: "denied" });
  expect(match(err("denied"), { ok: () => "allowed", err: (reason) => reason })).toBe("denied");
  expect(unwrapOr(ok(0), 9)).toBe(0);
  expect(okVoid()).toEqual(ok(undefined));
  expect(combine([ok(2), ok(4)])).toEqual(ok([2, 4]));
  expect(combine([ok(2), err("first"), err("second")])).toEqual(err("first"));
  expect(combine([])).toEqual(ok([]));
  const success = await tryAsync(
    () => Promise.resolve(8),
    () => ({ code: "internal.unexpected", message: "Unexpected failure.", retryable: false }),
  );
  expect(success).toEqual(ok(8));
  const checkNarrowing = (narrowed: Result<string, number>) => {
    if (narrowed.ok) {
      expectTypeOf(narrowed.value).toEqualTypeOf<string>();
    } else {
      expectTypeOf(narrowed.error).toEqualTypeOf<number>();
    }
  };
  checkNarrowing(ok("safe"));
  checkNarrowing(err(1));
});

it("captures rejected promises and synchronous foreign failures through tryAsync", async () => {
  const rejected = await tryAsync(() => Promise.reject(new Error("foreign detail")), fromThrown);
  expect(rejected.ok).toBe(false);
  expect(JSON.stringify(rejected)).not.toContain("foreign detail");
  const synchronous = await tryAsync(() => {
    throw new Error("foreign detail");
  }, fromThrown);
  expect(synchronous.ok).toBe(false);
  const unreachable = assertNever as (value: unknown) => never;
  expect(() => unreachable("private value")).toThrow("An unreachable branch was reached.");
});
