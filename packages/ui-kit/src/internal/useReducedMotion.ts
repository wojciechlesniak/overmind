// SPDX-License-Identifier: Apache-2.0
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const serverSnapshot = () => false;

function mediaQuery(): MediaQueryList | undefined {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : undefined;
}

function subscribe(onChange: () => void): () => void {
  const media = mediaQuery();
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return mediaQuery()?.matches ?? false;
}

/** Observe the user's motion preference; server rendering has no DOM dependency. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
