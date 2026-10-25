// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type { PolymorphicProps } from "./polymorphic.ts";

describe("polymorphic props", () => {
  it("retains anchor and custom property inference", () => {
    type Props = PolymorphicProps<"a", { tone: "quiet" }>;
    expectTypeOf<Props["href"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Props["tone"]>().toEqualTypeOf<"quiet">();
    expectTypeOf<Props["as"]>().toEqualTypeOf<"a" | undefined>();
  });
  it("retains button properties without admitting link properties", () => {
    type Props = PolymorphicProps<"button", { disabled: "custom" }>;
    expectTypeOf<Props["disabled"]>().toEqualTypeOf<"custom">();
    expectTypeOf<Extract<keyof Props, "href" | "ref">>().toEqualTypeOf<never>();
  });
  it("infers caller component properties without router dependencies", () => {
    function Control({ active }: { active: boolean }) {
      return createElement("button", { disabled: !active });
    }
    type Props = PolymorphicProps<typeof Control, { tone: "quiet" }>;
    expectTypeOf(Control).parameter(0).toEqualTypeOf<{ active: boolean }>();
    expectTypeOf<Props["active"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Props["tone"]>().toEqualTypeOf<"quiet">();
  });
});
