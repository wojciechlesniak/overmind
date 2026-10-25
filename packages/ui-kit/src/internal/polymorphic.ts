// SPDX-License-Identifier: Apache-2.0
import type { ComponentPropsWithoutRef, ElementType } from "react";

/** Infer native or caller-provided element props without depending on a router. */
export type PolymorphicProps<E extends ElementType, P> = P & { as?: E } & Omit<
    ComponentPropsWithoutRef<E>,
    keyof P | "as"
  >;
