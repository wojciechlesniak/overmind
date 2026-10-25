// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion.ts";

function setupMedia(matches: boolean) {
  const media = Object.assign(new EventTarget(), {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal("matchMedia", matchMedia);
  return { media, matchMedia };
}

describe("useReducedMotion", () => {
  it("reads the initial preference and subscribes to actual change events", () => {
    const { media, matchMedia } = setupMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    act(() => {
      media.matches = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(result.current).toBe(false);
    act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(result.current).toBe(true);
  });

  it("removes its exact listener when the component unmounts", () => {
    const { media } = setupMedia(false);
    const add = vi.spyOn(media, "addEventListener");
    const remove = vi.spyOn(media, "removeEventListener");
    const { unmount } = renderHook(() => useReducedMotion());
    const listener = add.mock.calls[0]?.[1];
    expect(listener).toBeTypeOf("function");
    unmount();
    expect(remove).toHaveBeenCalledExactlyOnceWith("change", listener);
  });

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("renders the deterministic server snapshot even when the browser prefers reduction", () => {
    setupMedia(true);
    function Preference() {
      return createElement("output", null, String(useReducedMotion()));
    }
    expect(renderToString(createElement(Preference))).toBe("<output>false</output>");
  });

  it("renders on a server without window", () => {
    const originalWindow = window;
    vi.stubGlobal("window", undefined);
    function Preference() {
      return createElement("output", null, String(useReducedMotion()));
    }
    try {
      expect(renderToString(createElement(Preference))).toBe("<output>false</output>");
    } finally {
      vi.stubGlobal("window", originalWindow);
    }
  });
});
