import { z } from "zod";

export const text = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\p{Cc}]+$/u);
