// SPDX-License-Identifier: Apache-2.0
import { useId as reactUseId } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useId } from "./useId.ts";

describe("useId", () => {
  it("reuses React's hook without a separate ID generator", () => {
    expect(useId).toBe(reactUseId);
  });
  it("preserves stable distinct IDs over a real rerender", () => {
    const { result, rerender } = renderHook(() => [useId(), useId()] as const);
    const initial = result.current;
    expect(initial[0]).not.toBe(initial[1]);
    rerender();
    expect(result.current).toEqual(initial);
  });
});
