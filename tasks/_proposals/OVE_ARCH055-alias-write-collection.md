# Finite alias-write collection allocation

Base: DEVELOP `c4a514f1d511366b21e7a414cb3fcf27707bda44`.
OVE_ARCH055 and its provider were absent from that canonical task inventory.
SETUP002 and SETUP004 are done; this registration creates no claim or implementation.

Own only `tools/boundaries/ts-alias-writes.ts` and its adjacent test.
The first consumer is OVE_ARCH021. Exact same-project Tools API:

```ts
export interface AliasSelection {
  readonly object: ts.Node;
  readonly segments: readonly string[];
}
export interface AliasWrites {
  readonly writes: ReadonlyMap<ts.Symbol, readonly ts.Expression[]>;
  readonly selections: ReadonlyMap<ts.Symbol, readonly AliasSelection[]>;
  readonly propertyWrites: ReadonlyMap<ts.Symbol, ReadonlyMap<string, readonly AliasSelection[]>>;
  readonly bindings: ReadonlySet<ts.Symbol>;
  readonly assignmentTargets: ReadonlySet<ts.Identifier>;
  readonly symbolOf: (node: ts.Identifier) => ts.Symbol | undefined;
  readonly key: (node: ts.Node) => string;
  readonly elementKey: (node: ts.Expression) => string;
}
export function aliasWritesOf(source: ts.SourceFile, checker: ts.TypeChecker): AliasWrites;
```

Move only the approved current collector allocation: collection maps/sets,
collect, collectSelection, addWrite, addMemberWrite and symbolOf/key/elementKey.
Return fresh readonly facts and those single shared helper implementations.
No forbidden-name input, policy, path evaluation, shadow admission, fixed point,
I/O, source execution, ESLint decision or generic visitor is introduced.
Parent021 retains those decisions, its public API and all three-helper acceptance.

Keep original86 bodies exactly once:55 capability cases in021 and31 imports/comments
cases in054, including the real checker fixture, offsets and budgets. New direct
collector tests have independent assertions; they do not duplicate original bodies.

The integrator appends OVE_ARCH055 to canonical021 depends_on, its provider to
needs and its Task path to reads. Retain status, owns, original requirements,
all four unchecked criteria and every other byte. Preserve the active parent's
claim/nonce and committed repairs in private escrow; do not edit that worktree.
Generate INDEX/DEPENDENCIES normally, never by hand. Combine only explicitly
coordinated metadata; unrelated definitions retain their own scopes and owners.

After registration/reviews/gates land, claim055 normally in an isolated worktree.
Transfer only the hashed collector allocation and implement with actual RED/GREEN,
normal full checks/reviews/lifecycle. Child source completion grants no021 acceptance.
Only after its normal DONE merge does021 rebase, import the factory in its own
module and rerun every preserved/current case and unchanged checker budget.
Remeasure both tasks including all status/acceptance additions and deletions;
no formatting compression, test weakening, scope waiver or root-policy edit.

Exact transfer input: parent checkpoint `e57d2e6c38fea66afbf0211d5b61f0b54e05b2d6`.
The full globals file SHA256 is `6c73d8f8fd10d5882b949948160ce0877a4d2267b1365b9d08f50f930f6c44d6`;
parent tests SHA256 is `00e1daab0f65c5cc6f6f20825ccebaa1db1db0a9f5cf00f2e31b3e0699cd124f`.
Transfer only the enumerated collection seam; all other parent code remains its owner's work.
The private escrow records Git mode 100644 separately from its read-only private file mode.
