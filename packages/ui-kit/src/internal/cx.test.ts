// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { cx } from "./cx.ts";

describe("cx", () => {
  it("joins class names in declaration order and omits absent values", () => {
    expect(cx("root", false, null, undefined, "", "selected")).toBe("root selected");
  });

  it("leaves compound class strings intact", () => {
    expect(cx("layout row", "wide")).toBe("layout row wide");
    expect(cx()).toBe("");
  });
});
