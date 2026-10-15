// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("initialises DOM matchers and browser stubs for a per-file environment", () => {
  render(createElement("div", { "data-testid": "environment-probe" }, "ready"));
  expect(screen.getByTestId("environment-probe")).toBeInTheDocument();
  expect(matchMedia("(min-width: 1px)").matches).toBe(false);
  new ResizeObserver(() => undefined).observe(document.body);
  expect(new IntersectionObserver(() => undefined).takeRecords()).toEqual([]);
  scrollTo(0, 0);
  expect(() => fetch("https://example.com")).toThrow("Network access is forbidden");
});

it("cleans rendered DOM after the previous test", () => {
  expect(screen.queryByTestId("environment-probe")).not.toBeInTheDocument();
});
