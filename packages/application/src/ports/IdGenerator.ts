// SPDX-License-Identifier: Apache-2.0
import type { EntityId, IdPrefix } from "@overmind/contracts";

/** IDs are sortable identifiers; never use them as secrets or authorization proofs. */
export interface IdGenerator {
  next<P extends IdPrefix>(prefix: P): EntityId<P>;
}
