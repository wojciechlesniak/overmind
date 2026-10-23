// SPDX-License-Identifier: Apache-2.0
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { isoNow, ms, seconds } from "@overmind/application/ports";
import type {
  Clock,
  Cancel,
  CancellationSignal,
  TimerOptions,
  IdGenerator,
} from "@overmind/application/ports";
import type { EntityId } from "@overmind/contracts";

describe("time port helpers", () => {
  it("converts units without reading ambient time", () => {
    expect(ms(1234)).toEqual({ ok: true, value: 1234 });
    expect(ms(-1)).toEqual({ ok: true, value: -1 });
    expect(seconds(1.5)).toEqual({ ok: true, value: 1500 });
    expect(seconds(-1)).toEqual({ ok: true, value: -1000 });
    const value = "2026-01-01T00:00:00.000Z";
    expect(isoNow({ nowIso: () => value })).toBe(value);
  });
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 0.5])(
    "rejects invalid millisecond duration %j",
    (value) => {
      expect(ms(value)).toEqual({
        ok: false,
        error: {
          code: "validation.invalid_input",
          message: "The input is invalid.",
          retryable: false,
        },
      });
    },
  );
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, 0.0001])(
    "rejects invalid or overflowing second conversion %j",
    (value) => {
      expect(seconds(value)).toEqual({
        ok: false,
        error: {
          code: "validation.invalid_input",
          message: "The input is invalid.",
          retryable: false,
        },
      });
    },
  );
  it("accepts native abort state and once listeners through the portable protocol", () => {
    const controller = new AbortController();
    const signal: CancellationSignal = controller.signal;
    const onAbort = vi.fn(() => undefined);
    expect(signal.aborted).toBe(false);
    signal.addEventListener("abort", onAbort, { once: true });
    controller.abort();
    expect(signal.aborted).toBe(true);
    expect(onAbort).toHaveBeenCalledTimes(1);
    controller.abort();
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
  it("removes the exact abort callback without firing it", () => {
    const controller = new AbortController();
    const signal: CancellationSignal = controller.signal;
    const onAbort = vi.fn(() => undefined);
    signal.addEventListener("abort", onAbort, { once: true });
    signal.removeEventListener("abort", onAbort);
    controller.abort();
    expect(signal.aborted).toBe(true);
    expect(onAbort).not.toHaveBeenCalled();
  });
  it("preserves the portable Clock and prefix-specific generator contract", () => {
    expectTypeOf<Clock["setTimer"]>().parameter(2).toEqualTypeOf<TimerOptions | undefined>();
    expectTypeOf<Clock["setInterval"]>().returns.toEqualTypeOf<Cancel>();
    expectTypeOf<Clock["sleep"]>().returns.toEqualTypeOf<Promise<void>>();
    const nextRunId = (ids: IdGenerator) => ids.next("run");
    expectTypeOf(nextRunId).returns.toEqualTypeOf<EntityId<"run">>();
  });
});
