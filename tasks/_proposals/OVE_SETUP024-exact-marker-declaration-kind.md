# SETUP024: exact declaration-kind repair after source review

The source-only integration checkpoint `9f0245838f008acca952fdb76fe8009946b837d9`
contains the exact approved SETUP024 and OSS016 handoffs. Independent whole
Standards and Spec inspection identified a SETUP024 const-only classification
error: the TypeScript Const bit overlaps the AwaitUsing declaration kind.

A real public-API negative test confirmed the defect on pinned Node 22.23.3 and
TypeScript 6.0.3. The valid const control passed; the resource-management input
was incorrectly accepted. The probe parsed source data without executing it.
The retained RED proof SHA256 is
`fdb89789f37b052a85c66e00ee554f2f7637e1b5a60d9ea7f51c45a2d85376b3`.

The integrator applies only this finite correction in its separate source worktree:

- Compare the masked BlockScoped declaration kind to Const exactly in
  `tools/package-engine/foundationHooks.parse-boundary.ts`.
- Append using and await-using negative inputs to the existing fixed-error unit
  table in `tools/package-engine/foundationHooks.test.ts`. Preserve every original
  case, assertion, fixture and deadline.
- Preserve the other six source blobs, both original author escrows, claims,
  Task statuses, acceptance criteria and all required gates.

This follows the Owner's session instruction to fix review findings and complete
security validation. The original author handoffs remain evidence of the original
blobs; their hashes are not presented as approval of this later repair. Record
both pre-repair and repaired pins separately, followed by fresh independent whole
reviews and exact-head checks before any normal source integration.

Do not edit either author's worktree or claim. Formal SETUP024 rebase must retain
this reviewed merged denial and the original claim identity; normal task finish
and actual acceptance remain separate. OSS016's cold CLI failures and the incomplete
broad tests remain blocking. This repair grants no timeout, policy, scope, history
or test exception and claims no full-suite PASS or task completion.
