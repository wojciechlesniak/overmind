// SPDX-License-Identifier: Apache-2.0
import { createElement, StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useControllableState } from "./useControllableState.ts";
import type { ControllableStateOptions } from "./useControllableState.ts";

describe("useControllableState", () => {
  it("updates uncontrolled state and emits the next value", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));
    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
    act(() => {
      result.current[1](1);
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("uses a controlled value until the host supplies its replacement", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useControllableState({ value, defaultValue: 0, onChange }),
      { initialProps: { value: 2 } },
    );
    act(() => {
      result.current[1](3);
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
    expect(result.current[0]).toBe(2);
    rerender({ value: 3 });
    expect(result.current[0]).toBe(3);
  });

  it("uses the default only for initial uncontrolled state", () => {
    const { result, rerender } = renderHook(
      ({ defaultValue }) => useControllableState({ defaultValue }),
      { initialProps: { defaultValue: 1 } },
    );
    rerender({ defaultValue: 9 });
    expect(result.current[0]).toBe(1);
  });

  it("reports only committed mode transitions with no component values", () => {
    const onModeChange = vi.fn();
    const options: ControllableStateOptions<string> = { defaultValue: "private", onModeChange };
    const { rerender } = renderHook((props) => useControllableState(props), {
      initialProps: options,
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    expect(onModeChange).not.toHaveBeenCalled();
    rerender({ ...options, value: "controlled" });
    rerender({ ...options, value: "changed" });
    rerender(options);
    expect(onModeChange.mock.calls).toEqual([
      [{ code: "CONTROL_MODE_CHANGED", from: "uncontrolled", to: "controlled" }],
      [{ code: "CONTROL_MODE_CHANGED", from: "controlled", to: "uncontrolled" }],
    ]);
  });

  it("emits no production diagnostic", () => {
    vi.stubEnv("DEV", false);
    const onModeChange = vi.fn();
    const options: ControllableStateOptions<number> = { defaultValue: 0, onModeChange };
    const { rerender } = renderHook((props) => useControllableState(props), {
      initialProps: options,
    });
    rerender({ ...options, value: 1 });
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("does not output anything when no development diagnostic sink is supplied", () => {
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const options: ControllableStateOptions<number> = { defaultValue: 0 };
    const { rerender } = renderHook((props) => useControllableState(props), {
      initialProps: options,
    });
    rerender({ ...options, value: 1 });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps falsy defined values controlled", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: false, defaultValue: true, onChange }),
    );
    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(false);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("keeps null controlled when it is a value in the input contract", () => {
    const { result } = renderHook(() =>
      useControllableState<string | null>({ value: null, defaultValue: "fallback" }),
    );
    expect(result.current[0]).toBeNull();
  });
});
