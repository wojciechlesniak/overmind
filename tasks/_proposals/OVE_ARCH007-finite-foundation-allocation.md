# ARCH007 finite foundation allocation

Source baseline: DEVELOP 99a25efb140ca532c7e405dddddfccd6768e4003.
Owner on 2026-10-23 delegated routine MVP decisions and required compliant free
dependencies, independent reviews/security checks and ordinary after-green merges.
No source, claim, test, acceptance or merge is represented by this registration.

ARCH056 owns browser-safe IDs and time/ID interfaces; ARCH057 owns system scaffolding
and actual ULID generation; ARCH058 owns SystemClock after the actual ARCH004 Logger.
Existing capabilities move once: EntityId/Clock/IdGenerator to056, lib:ids to057.
Parent007 keeps all original requirements and seven unchecked acceptance criteria.
Only seven existing direct007 edges in the TEST003 prerequisite ancestry change to056:
ARCH004/005/010/013/014 and TEST002/003. TEST003 additionally depends057/058 so
real-adapter registration cannot be claimed before the real adapters exist. Other
consumers continue to wait for full parent007. No fake waiver or placeholder suite.

Workspace chooses wsp to satisfy the original uniform three-letter invariant.
The four future ws_ examples (WFRT002, AGENT010, DATA010, AGENT003) are illustrative
invalid fixtures under this contract; their owning implementations must use wsp.
Both timer kinds gain an optional ref option, defaultfalse. No product feature added.
Clock imports the real Logger interface only after004; no structural duplicate or
callback sink replaces logging/redaction or changes its failure contract.

Finite integrator-owned source allocation when the relevant child is ready:
- ARCH057: append only system to root tsconfig.json references; regenerate the lock
  with pinned pnpm for the exact new workspace, frozen reinstall and review the diff.
  Historical completed ownership in ARCH030/SETUP001 is not an active task claim.
- ARCH058: append SystemClock export and usage to the ARCH057 public seed and README.
- Future ARCH009 alone generates aggregators; these are explicit additive seeds.
No broad ownership of root settings or dependency-policy/configuration changes.

Expected source sizes:056 <=250 non-test lines/two packages,057 <=250/one package
plus finite root wiring,058 <=200/one package. All actual tests, native lifecycle,
independent exact-head reviews, hosted and post-DEVELOP checks remain mandatory.
