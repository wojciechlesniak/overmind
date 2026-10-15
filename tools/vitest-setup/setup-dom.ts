import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const noop = () => {
  /* No browser layout or listeners run in this deterministic stub. */
};
class ResizeObserverStub implements ResizeObserver {
  disconnect = noop;
  observe = noop;
  unobserve = noop;
}
class IntersectionObserverStub implements IntersectionObserver {
  root = null;
  rootMargin = "0px";
  scrollMargin = "0px";
  thresholds = [0];
  disconnect = noop;
  observe = noop;
  unobserve = noop;
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  vi.stubGlobal("scrollTo", noop);
});
afterEach(cleanup);
