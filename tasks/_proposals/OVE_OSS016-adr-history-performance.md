# OVE_OSS016: finite ADR history query registration

Status: proposed; no task claim or production implementation.

## Requested registration

1. Add the accompanying OVE_OSS016 Task as TODO with all five criteria unchecked.
2. In canonical OVE_OSS014, change only `depends_on` from
   `[OVE_OSS005, OVE_OSS006]` to `[OVE_OSS005, OVE_OSS006, OVE_OSS016]`.
   Its TODO status, exact owns, eight requirements/criteria and migration contract remain unchanged.
3. Append OVE_OSS016 only to canonical SETUP024 depends_on; preserve its TODO status,
   five unchecked criteria, owns and every other byte. Its original claim was valid
   when made; keep it parked and preserve its nonce rather than reset or reclaim it.
4. Regenerate task indexes through their normal generator; do not hand-edit them.
5. After ordinary metadata checks, independent reviews and exact-head hosted gates,
   merge registration normally; implementation then needs the normal atomic claim/new worktree.

## Verified ownership and size

- At green DEVELOP `c4a514f1d511366b21e7a414cb3fcf27707bda44`, OSS016 is unused.
- OSS006 is DONE and owns ADR tooling. Future OSS014 is TODO and owns exact `tools/adr/history.ts`;
  its added hard dependency serializes that shared file without altering the migration design.
- OSS016 owns only `history.ts` plus new `history-performance.test.ts` and
  `history-performance.int.test.ts`; estimated production delta is below 40 non-test lines.
- Existing `HistoryGit`/`checkHistory` suffice; no public API, dependency or provider capability is added.

## Actual blocker and bounded cost evidence

SETUP024 source `c0dcdfbc75a9b6b31a37a32243fe74121b7b91d6` is clean and package-only.
Its unchanged full integrations first returned 115 PASS/2 FAIL, then 116 PASS/1 FAIL.
The repeated tampered archive case hit `spawnSync` ETIMEDOUT at the original 3000 ms child limit;
the original case remains 15000 ms. Both failures and raw outputs are retained.

Fresh isolated real-Git diagnosis used unchanged tooling equivalent to green DEVELOP,
the same 3000 ms children, shared CPU lock and no source writes. Complete public CLI:
2001 ms/status 0; production-port profile: 68 Git calls, including 30 `log` and
30 `rev-list` calls, with `rev-list` totaling 638 ms. Tampered public CLI:
1663 ms/status 1 with the exact archive denial; profile: 40 calls, 30 `log` and
two `rev-list` calls totaling 36.8 ms. Working bytes/index/config/refs stayed unchanged.
These diagnostics are not a repeated full-suite PASS. The timeout cause remains UNCONFIRMED,
and the candidate is not proved sufficient for the tampered case.

## Exact optimization boundary

After full commit-ID validation, identical head/base and exact per-record pathspec permit
invocation-local membership reuse from the already validated `commits` list.
Divergent refs MUST retain the original `rev-list`; matching trees are insufficient.
Every historical version, denial, label distinction, budget, batch and bounded fallback stays intact.
Original public cases/full integrations must pass before acceptance. Any remaining failure
blocks completion and requires a separately registered owning proposal, never a deadline increase.
Normal `config-change`/Owner protection for ADR tooling and independent whole reviews remain mandatory.

## Retained evidence

- Current diagnostic: `oss016-current-cost-diagnostic-20261022.json`, SHA256
  `a039647a08583466dfb9012c9a105f3f4e036321d55ccd6c2ea7c26a8dd7361a`.
- Coordinator receipt: `oss016-current-cost-diagnostic-20261022-01.json`, SHA256
  `0a1d1eadf8b887072e8523e81219210256c3fc90ae0abe206aaef6032cc56dcd`.
- Reproduced blocker handoff: `setup024-adr-reproduced-blocker-handoff-20261022.md`, SHA256
  `b83bee7d9f9e24abecfd2523e6d2ddad89b5818c83de40a68968837c223ea9aa`.
- All receipts/raw outputs/helpers are in the retained private session evidence directory.

## Finite source handoff and complete acceptance

The current DEVELOP contains the separately reproduced packaging defect, while
SETUP024 alone reproduces the ADR timeout. Neither source head may bypass a failing
check. Each author keeps its own claim, branch, worktree and owned source changes.
The integrator may apply their exact approved source-only proposals in a separate
integration worktree, with original Task statuses and claims unchanged. Never edit
another author's worktree or replay unrelated bulk work.

That exact combined source head requires real full unit/integration, native,
security and applicable checks, both independent whole reviews and all required
hosted gates before ordinary integration. Any failure blocks integration; no
test exclusion, retry-setting change, relaxed deadline or acceptance waiver is introduced.
Source integration alone completes neither task. Preserve original commits and
hashed source escrow before normal rebase; verify the merged source pins and keep
original claim identity/nonce. Then use normal task:finish review/DONE transitions,
fresh exact-head checks and independent reviews for formal task acceptance.
Complete OSS016 first, then SETUP024 from its latest merged dependency. Their own
acceptance criteria remain unchanged and must all have real evidence.

## Exact SETUP024 handoff

Approved source checkpoint: `c0dcdfbc75a9b6b31a37a32243fe74121b7b91d6`.
Retained manifest SHA256: `ad94c80398a2fc482bd6d600b0bd72633c2b3caa0c2ad14ce2cf847a114257fa`.

| Source path | Git mode | SHA256 |
| --- | --- | --- |
| `docs/engineering/engine-packaging.md` | 100644 | `f2a327491790e0ed2b1e654426c1b75f11424a8eec9224e16d717e318774a8c6` |
| `tools/package-engine/foundationHooks.int.test.ts` | 100644 | `99a8bd4cb49658862e833fd68d44dfede858850f0f5c9039d6f931b4923cac19` |
| `tools/package-engine/foundationHooks.parse-boundary.ts` | 100644 | `0d209767cdd26609dca0a955f1327b5dcb9bc7e6b8b91e0d2a7b19c1ae1e8a81` |
| `tools/package-engine/foundationHooks.test.ts` | 100644 | `67f9661090920fdcbe4de18c4cffa46f35803c419d15f4e456966de1c30cd26a` |
| `tools/package-engine/steps/verify.ts` | 100644 | `c283b792908c41222fe8767ae8b905637b83aa6286b68b36c214e841ff27212a` |

Filter only these five paths from mixed commits; never apply their Task metadata.
Before assembly, require the same explicit owner-approved blob/mode manifest for
OSS016's three owned source/test paths and verify every pin after application.
