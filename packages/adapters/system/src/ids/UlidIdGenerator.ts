// SPDX-License-Identifier: Apache-2.0
import { randomBytes } from "node:crypto";
import type { IdGenerator } from "@overmind/application/ports";
import {
  entityId,
  idPrefixSchema,
  createAppError,
  errorRegistry,
  type EntityId,
  type IdPrefix,
} from "@overmind/contracts";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const maxTimestamp = 2 ** 48 - 1;
const maxRandom = (1n << 80n) - 1n;
type IdSchema = ReturnType<typeof entityId>;

function encode(value: bigint, width: number): string {
  let encoded = "";
  for (let index = 0; index < width; index++) {
    encoded = alphabet.charAt(Number(value & 31n)) + encoded;
    value >>= 5n;
  }
  return encoded;
}
function fail(code: "internal.unexpected" | "validation.invalid_input"): never {
  const error = createAppError(code, errorRegistry[code]);
  throw Object.assign(new Error(error.message), error);
}
function entropy(): bigint {
  try {
    return randomBytes(10).reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
  } catch {
    fail("internal.unexpected");
  }
}
function failInvariant(): never {
  // assertNever accepts only an exhaustively narrowed never, not numeric overflow.
  const error = new Error("ULID generation invariant failed.");
  error.name = "InvariantError";
  throw error;
}
function matchesPrefix<P extends IdPrefix>(
  value: string,
  prefix: P,
  schema: IdSchema,
): value is EntityId<P> {
  return value.startsWith(prefix + "_") && schema.safeParse(value).success;
}

/** Node entropy stays in this adapter; IDs are never authorization credentials. */
export class UlidIdGenerator implements IdGenerator {
  readonly #readTimestamp: () => number;
  readonly #schemas = new Map<string, IdSchema>();
  #lastTimestamp = -1;
  #random = 0n;
  #encodedTimestamp = "";

  constructor(readTimestamp: () => number = Date.now) {
    this.#readTimestamp = readTimestamp;
  }

  next<P extends IdPrefix>(prefix: P): EntityId<P> {
    let schema = this.#schemas.get(prefix);
    if (!schema) {
      const parsed = idPrefixSchema.safeParse(prefix);
      if (!parsed.success) {
        fail("validation.invalid_input");
      }
      schema = entityId(parsed.data);
      this.#schemas.set(parsed.data, schema);
    }
    let timestamp: number;
    try {
      timestamp = this.#readTimestamp();
    } catch {
      fail("internal.unexpected");
    }
    if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > maxTimestamp) {
      fail("validation.invalid_input");
    }
    const effectiveTimestamp = Math.max(timestamp, this.#lastTimestamp);
    const random = effectiveTimestamp > this.#lastTimestamp ? entropy() : this.#random + 1n;
    if (random > maxRandom) {
      failInvariant();
    }
    const encodedTimestamp =
      effectiveTimestamp > this.#lastTimestamp
        ? encode(BigInt(effectiveTimestamp), 10)
        : this.#encodedTimestamp;
    const candidate = prefix + "_" + encodedTimestamp + encode(random, 16);
    if (!matchesPrefix(candidate, prefix, schema)) {
      failInvariant();
    }
    // Commit state only after entropy and the canonical public schema succeed.
    this.#lastTimestamp = effectiveTimestamp;
    this.#encodedTimestamp = encodedTimestamp;
    this.#random = random;
    return candidate;
  }
}
