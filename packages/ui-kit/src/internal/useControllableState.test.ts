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

describe("batched controllable state requests", () => {
  it("applies a complete uncontrolled round trip in one commit", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));
    act(() => {
      result.current[1](1);
      result.current[1](0);
    });
    expect(result.current[0]).toBe(0);
    expect(onChange.mock.calls).toEqual([[1], [0]]);
  });

  it("emits one change for repeated pending uncontrolled values", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));
    act(() => {
      result.current[1](1);
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("preserves the round trip under StrictMode without duplicate notifications", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    act(() => {
      result.current[1](1);
      result.current[1](0);
    });
    expect(result.current[0]).toBe(0);
    expect(onChange.mock.calls).toEqual([[1], [0]]);
  });

  it("preserves function-valued state without invoking its values", () => {
    const initial = vi.fn(() => 1);
    const next = vi.fn(() => 2);
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState<() => number>({ defaultValue: initial, onChange }),
    );
    expect(result.current[0]).toBe(initial);
    act(() => {
      result.current[1](next);
    });
    expect(result.current[0]).toBe(next);
    expect(initial).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("uses the current callback for a batched request after rerender", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onChange }) => useControllableState({ defaultValue: 0, onChange }),
      { initialProps: { onChange: first } },
    );
    rerender({ onChange: second });
    act(() => {
      result.current[1](1);
      result.current[1](0);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls).toEqual([[1], [0]]);
    expect(result.current[0]).toBe(0);
  });

  it("keeps the provided prop authoritative when the controlled host ignores a request", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: 5, defaultValue: 0, onChange }),
    );
    act(() => {
      result.current[1](6);
      result.current[1](5);
    });
    expect(result.current[0]).toBe(5);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
  });
});
