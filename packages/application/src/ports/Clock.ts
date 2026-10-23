// SPDX-License-Identifier: Apache-2.0
import {
  createAppError,
  err,
  errorRegistry,
  ok,
  type Instant,
  type Result,
} from "@overmind/contracts";

export type Cancel = () => void;
export interface TimerOptions {
  readonly ref?: boolean;
}
/** Minimal cancellation protocol; native AbortSignal and deterministic fakes implement it. */
export interface CancellationSignal {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
}
export interface SleepOptions {
  readonly signal?: CancellationSignal;
}

/** Wall time may regress; monotonic time must never decrease. No ambient effects here. */
export interface Clock {
  now(): Date;
  nowIso(): Instant;
  monotonicMs(): number;
  /** Zero yields to the event loop; negative delays become zero; abort rejects internal.cancelled. */
  sleep(milliseconds: number, options?: SleepOptions): Promise<void>;
  /** One-shot timer; unref by default. Cancellation is idempotent. */
  setTimer(callback: () => void, milliseconds: number, options?: TimerOptions): Cancel;
  /** Repeating timer; unref by default. Cancellation is idempotent. */
  setInterval(callback: () => void, milliseconds: number, options?: TimerOptions): Cancel;
}

function invalidDuration(): Result<number> {
  return err(createAppError("validation.invalid_input", errorRegistry["validation.invalid_input"]));
}
/** Safe integer millisecond helpers preserve negatives; timer adapters normalize negatives to zero. */
export function ms(milliseconds: number): Result<number> {
  return Number.isSafeInteger(milliseconds) ? ok(milliseconds) : invalidDuration();
}
export function seconds(value: number): Result<number> {
  return Number.isFinite(value) ? ms(value * 1000) : invalidDuration();
}
export function isoNow(clock: Pick<Clock, "nowIso">): Instant {
  return clock.nowIso();
}
