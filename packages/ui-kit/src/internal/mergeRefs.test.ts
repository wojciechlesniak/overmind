// SPDX-License-Identifier: Apache-2.0
import { createElement, createRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mergeRefs } from "./mergeRefs.ts";

describe("mergeRefs", () => {
  it("assigns all object and callback refs and clears them on unmount", () => {
    const object = createRef<HTMLButtonElement>();
    const callback = vi.fn();
    const { getByRole, unmount } = render(
      createElement("button", { ref: mergeRefs(object, callback, undefined, null) }),
    );
    const button = getByRole("button");
    expect(object.current).toBe(button);
    expect(callback).toHaveBeenCalledExactlyOnceWith(button);
    unmount();
    expect(object.current).toBeNull();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it("honours callback cleanup once instead of sending that callback null", () => {
    const object = createRef<HTMLButtonElement>();
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const { unmount } = render(createElement("button", { ref: mergeRefs(callback, object) }));
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(object.current).toBeNull();
  });

  it("cleans the previous callback attachment before a new node replaces it", () => {
    const first = document.createElement("button");
    const second = document.createElement("button");
    const order: string[] = [];
    const merged = mergeRefs<HTMLButtonElement>((node) => {
      order.push(node === first ? "first attached" : "second attached");
      return () => {
        order.push(node === first ? "first removed" : "second removed");
      };
    });
    merged(first);
    merged(second);
    merged(null);
    expect(order).toEqual(["first attached", "first removed", "second attached", "second removed"]);
  });
});
