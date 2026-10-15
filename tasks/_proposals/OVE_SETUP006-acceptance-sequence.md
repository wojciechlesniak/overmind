# SETUP006 acceptance sequence

Status: accepted by the Owner on 2026-10-15: "Zatwierdzam etapowy odbiór i dalszą pracę". This is the authoritative acceptance sequence for SETUP006; operational isolation and release safeguards remain mandatory.

## Why completion currently stalls

SETUP006 section 4 excludes runner provisioning (SETUP021), the real escape
harness (TEST007) and the boundary checker (ARCH002), but section 11 requires
their end-to-end evidence before completing the foundation pipeline. SETUP021
itself depends on SETUP006; TEST007 and ARCH002 depend on later product and
architecture tasks. The Owner requests sequential issue implementation and has
confirmed on 2026-10-15 that no dedicated CI Mac is available. The repository is
public, personally owned, and currently has no registered runners or forks.

GitHub offers macOS 26 hosted labels, but its arm64 runner documentation explicitly
excludes nested virtualization. That is not evidence that Apple container can run
there. Registering the Owner's daily-use Mac as an unrestricted public runner does
not satisfy the runner threat model and is not proposed.

## Approved acceptance change

1. Complete SETUP006 against its foundation deliverables: full hosted CI, license
   and advisory gates, real negative test/lint/GPL/advisory PRs, pinning/injection
   checks, strict missing-tool behavior, and tested fail-closed isolation admission
   and cleanup wiring. Both independent reviews must approve those deliverables.
2. Accept the trusted default-branch manual-dispatch adaptation documented in
   `OVE_SETUP006-trusted-isolation-trigger.md` for this personal public repository.
   PR/merge-group events stay hosted-only. Maintainers approve the exact head with
   fresh labels and full hosted checks; queued runs revalidate approval. This does
   not authorize registering an unrestricted runner or claim automatic isolation.
3. Move the physical labeled-PR/escape-evidence acceptance to SETUP021 + TEST007.
   Those tasks remain unfinished until a restricted dedicated/rented execution
   environment and the real Sandbox adapter/harness exist. No fake CLI or pipeline
   test counts as proof of product isolation. Trusted default-branch deployment is
   required before dispatch; merely merging to DEVELOP does not deploy it.
4. Move the actual boundary-violation scratch-PR evidence to ARCH002, which owns
   the checker. Keep the current strict-mode orchestration regression, explicitly
   identified as wiring evidence only.
5. Keep actual outside-contributor fork-run verification outstanding for repository
   hardening (SETUP018), after a fork under a separate writable account is
   available. Existing negative API fixtures and static read-only/no-secret checks
   are foundation evidence, not a claimed real fork run.
6. Release gating (SETUP014) must still require a successful real isolation result
   for the exact release commit. Missing runner/harness/evidence blocks release.
   The later isolation/security implementation cannot be marked done without it.

TASK006 and the named owner tasks record these responsibilities. Re-run Standards
and Spec reviews against this approved scope and merge only after all foundation
checks pass, then start SETUP007 from the updated DEVELOP. Approval of this
sequence is not evidence that any deferred operational test has run.

No license exception, install-policy bypass, suppressed workflow security finding,
weakened product escape assertion, paid service purchase or machine registration is
authorized by this proposal.

Sources: [GitHub hosted runner limitations](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
[runner-group access restrictions](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access),
TASK006 sections 4/5/9/11, TASK021 depends_on, TEST007 depends_on, ARCH002 depends_on.
