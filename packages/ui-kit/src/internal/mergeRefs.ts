// SPDX-License-Identifier: Apache-2.0
import type { Ref, RefCallback } from "react";

/** Compose object and callback refs, including React 19 callback cleanup. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  const cleanups: ((() => void) | undefined)[] = [];
  // Return void so both React 18's null callback and React 19's lifecycle work.
  return (node) => {
    refs.forEach((ref, index) => {
      const cleanup = cleanups[index];
      if (cleanup) {
        cleanups[index] = undefined;
        cleanup();
      }
      if (typeof ref === "function") {
        if (node === null && cleanup) {
          return;
        }
        const result = ref(node);
        if (typeof result === "function") {
          cleanups[index] = result;
        }
      } else if (ref) {
        ref.current = node;
      }
    });
  };
}
