# System adapters

`UlidIdGenerator` implements the application `IdGenerator` port with Node's
`crypto.randomBytes(10)`. It uses the canonical contracts prefix and ID schemas;
there is no external ULID library or permission to use ambient randomness in pure layers.

```ts
import { UlidIdGenerator } from "@overmind/adapter-system";
import type { IdGenerator } from "@overmind/application/ports";

const ids: IdGenerator = new UlidIdGenerator();
const runId = ids.next("run");
```

Each ID has a three-letter lowercase prefix, an underscore and a 26-character
Crockford-base32 ULID. Workspace uses `wsp`. Areas register their own prefixes;
the adapter accepts the shared three-letter syntax rather than freezing the initial list.
IDs with the same prefix are strictly increasing within one generator. The random
suffix increments during the same millisecond and on clock regression; a newer
millisecond obtains fresh 80-bit crypto entropy. Independent generators/processes
have probabilistic uniqueness, not a shared ordering or persistence guarantee.

The optional constructor argument is a timestamp function returning integer Unix
milliseconds in the inclusive range 0..281474976710655; tests can inject a controlled
time source without changing production entropy. Malformed prefix/time returns no ID
and throws an Error carrying the existing sanitized `validation.invalid_input` AppError fields. Unavailable
clock/entropy throws an Error carrying `internal.unexpected`. Exhausting all 80 random bits in a retained
millisecond throws an Error named `InvariantError`, preserving the contracts convention.
Failures do not advance the accepted timestamp/random state. No raw input/cause is logged.

IDs reveal creation time and are identifiers, never secrets, tokens, capability URLs
or Approval proofs. The composition root constructs this adapter and injects its port;
pure contracts/domain/application code does not import it. SystemClock is ARCH058;
shared fake/real contract-suite acceptance remains TEST002/003 and parent ARCH007.

The public-seam test generates 100,000 IDs and records an informational average
against the original 5-microsecond target, without changing timeouts or hiding results.
Root TypeScript references, frozen lockfile and the complete test/coverage inventory
require the finite integrator allocation before task acceptance; this README is not test evidence.
