import { z } from "zod";
export function record(value: unknown): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).parse(value);
}
export function number(value: unknown): number {
  return z.number().parse(value);
}
export function parseLine(value: string): Record<string, unknown> {
  const raw: unknown = JSON.parse(value);
  return record(raw);
}
