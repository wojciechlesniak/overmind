// SPDX-License-Identifier: Apache-2.0
import { performance } from "node:perf_hooks";
import type * as Crypto from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { entityId } from "@overmind/contracts";
import type { IdGenerator } from "@overmind/application/ports";
import { UlidIdGenerator } from "../index.ts";

const cryptoMock = vi.hoisted(() => vi.fn<(size: number) => Uint8Array>());
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof Crypto>();
  return {
    ...actual,
    randomBytes: cryptoMock.mockImplementation((size) => actual.randomBytes(size)),
  };
});
const actualCrypto = await vi.importActual<typeof Crypto>("node:crypto");
beforeEach(() => {
  cryptoMock.mockReset().mockImplementation((size) => actualCrypto.randomBytes(size));
});

it("generates 100k unique increasing canonical IDs through the actual public port", () => {
  const ids: IdGenerator = new UlidIdGenerator();
  const schema = entityId("run");
  const seen = new Set<string>();
  let previous = "";
  const started = performance.now();
  for (let index = 0; index < 100_000; index++) {
    const id = ids.next("run");
    expect(id > previous).toBe(true);
    expect(schema.safeParse(id).success).toBe(true);
    seen.add(id);
    previous = id;
  }
  const averageMicroseconds = ((performance.now() - started) * 1000) / 100_000;
  expect(seen.size).toBe(100_000);
  expect(cryptoMock).toHaveBeenCalledWith(10);
  console.info(
    JSON.stringify({
      benchmark: "100k public IDs with assertions",
      averageMicroseconds,
      targetMicroseconds: 5,
      informational: true,
    }),
  );
});

it("records generator-only performance using real time and crypto entropy", () => {
  const ids = new UlidIdGenerator();
  const started = performance.now();
  let last = "";
  for (let index = 0; index < 100_000; index++) {
    last = ids.next("run");
  }
  const averageMicroseconds = ((performance.now() - started) * 1000) / 100_000;
  expect(entityId("run").safeParse(last).success).toBe(true);
  console.info(
    JSON.stringify({
      benchmark: "100k public next calls",
      averageMicroseconds,
      targetMicroseconds: 5,
      informational: true,
    }),
  );
});

it("increments in one millisecond, including base32 carries, without refreshing entropy", () => {
  cryptoMock.mockReturnValue(new Uint8Array(10));
  const ids = new UlidIdGenerator(() => 0);
  const values = Array.from({ length: 34 }, () => ids.next("run"));
  expect(values[0]).toBe("run_00000000000000000000000000");
  expect(values[31]).toBe("run_0000000000000000000000000Z");
  expect(values[32]).toBe("run_00000000000000000000000010");
  expect(cryptoMock).toHaveBeenCalledTimes(1);
});

it("retains timestamp on regression and resumes fresh entropy only after time advances", () => {
  const times = [1000, 999, 1000, 1001];
  cryptoMock.mockReturnValue(new Uint8Array(10));
  const ids = new UlidIdGenerator(() => times.shift() ?? 1001);
  const values = Array.from({ length: 4 }, () => ids.next("wsp"));
  expect(values).toEqual(values.toSorted());
  expect(new Set(values).size).toBe(4);
  expect(values[0]?.slice(4, 14)).toBe(values[2]?.slice(4, 14));
  expect(values[3]?.slice(4, 14)).not.toBe(values[2]?.slice(4, 14));
  expect(cryptoMock).toHaveBeenCalledTimes(2);
});

it("supports the complete 48-bit timestamp range and canonical 80-bit entropy", () => {
  cryptoMock.mockReturnValue(new Uint8Array(10).fill(255));
  const id = new UlidIdGenerator(() => 2 ** 48 - 1).next("run");
  expect(id).toBe("run_7ZZZZZZZZZZZZZZZZZZZZZZZZZ");
  expect(entityId("run").safeParse(id).success).toBe(true);
});

it("fails closed on suffix overflow, does not wrap, and can resume at a newer timestamp", () => {
  let time = 1;
  cryptoMock.mockReturnValue(new Uint8Array(10).fill(255));
  const ids = new UlidIdGenerator(() => time);
  const previous = ids.next("run");
  expect(() => ids.next("run")).toThrow(expect.objectContaining({ name: "InvariantError" }));
  expect(() => ids.next("run")).toThrow(expect.objectContaining({ name: "InvariantError" }));
  expect(cryptoMock).toHaveBeenCalledTimes(1);
  time = 2;
  expect(ids.next("run") > previous).toBe(true);
});

it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2 ** 48])(
  "denies invalid numeric timestamp %# without consuming entropy",
  (time) => {
    expect(() => new UlidIdGenerator(() => time).next("run")).toThrow(
      expect.objectContaining({ code: "validation.invalid_input" }),
    );
    expect(cryptoMock).not.toHaveBeenCalled();
  },
);

it.each(["1", null, undefined, true, {}, 1n])("denies nonnumeric timestamp %#", (value) => {
  // @ts-expect-error: Deliberately malformed runtime clocks must be rejected.
  const ids = new UlidIdGenerator(() => value);
  expect(() => ids.next("run")).toThrow(
    expect.objectContaining({ code: "validation.invalid_input" }),
  );
  expect(cryptoMock).not.toHaveBeenCalled();
});

it.each(["", "ru", "RUN", "tool", "r_n", null, 42, undefined])(
  "denies malformed prefix %# before reading time or entropy",
  (prefix) => {
    const time = vi.fn(() => 0);
    const ids = new UlidIdGenerator(time);
    expect(() => {
      Reflect.apply(ids.next.bind(ids), undefined, [prefix]);
    }).toThrow(expect.objectContaining({ code: "validation.invalid_input" }));
    expect(time).not.toHaveBeenCalled();
    expect(cryptoMock).not.toHaveBeenCalled();
  },
);

it("accepts shared prefix syntax without freezing the initial registry", () => {
  expect(entityId("abc").safeParse(new UlidIdGenerator().next("abc")).success).toBe(true);
});

it("sanitizes unavailable clock and crypto failures without accepting an ID", () => {
  const ids = new UlidIdGenerator(() => {
    throw new Error("Synthetic clock failure");
  });
  expect(() => ids.next("run")).toThrow(
    expect.objectContaining({
      code: "internal.unexpected",
      message: "An unexpected error occurred.",
    }),
  );
  cryptoMock.mockImplementation(() => {
    throw new Error("Synthetic entropy failure");
  });
  expect(() => new UlidIdGenerator(() => 0).next("run")).toThrow(
    expect.objectContaining({ code: "internal.unexpected" }),
  );
});

it("does not advance state when a newer timestamp cannot obtain entropy", () => {
  let time = 1;
  cryptoMock.mockReturnValue(new Uint8Array(10));
  const ids = new UlidIdGenerator(() => time);
  const previous = ids.next("run");
  time = 2;
  cryptoMock.mockImplementationOnce(() => {
    throw new Error("Synthetic entropy failure");
  });
  expect(() => ids.next("run")).toThrow(expect.objectContaining({ code: "internal.unexpected" }));
  time = 1;
  const resumed = ids.next("run");
  expect(resumed > previous).toBe(true);
  expect(resumed.slice(4, 14)).toBe(previous.slice(4, 14));
  expect(cryptoMock).toHaveBeenCalledTimes(2);
});
