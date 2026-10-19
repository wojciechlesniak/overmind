# OVE_ARCH034: preserve existing process fixtures with foundation directories

## Exact finite integrator request

Change only `tools/build/engine/process.int.test.ts:106` from
`mkdirSync(resolve(app, "src", service ? "service" : "compose"));`
to `mkdirSync(resolve(app, "src", service ? "service" : "compose"), { recursive: true });`.
Before SHA256: `77ede73d12cada79938f5ae6e6b8cd60495ab2242a8e6bb63335b37df598a051`. Proposed SHA256: `60573a6765490c6c94336eaba9c3dfb4d56b8256057d08f347e0086ea3e9adf1`.

## Reason and evidence

034 adds the two specified foundation directories. The fixture first copies the
complete source tree, then creates the selected directory; the actual native
run failed14 of15 cases with EEXIST before their hook assertions executed.
Receipt: `ove034-native1-20261019.json` (SHA256
`65b5ca71c962d2996736038be3e8e012b577860155d4db315b41da57b3a60bd7`).
Normal lock regeneration/frozen install, full typecheck/lint and named CLI/scaffold
checks already passed in that retained failed run. Remaining checks were unrun.

This adapts fixture setup to existing directories. Keep every existing test body,
assertion, timeout, retry and cleanup. The following write still replaces the
marker with each real hook fixture; no product behavior or permission changes.
The completed033 process path is outside034 owns, so only the integrator applies
this exact one-line replacement. Normal current native checks and whole review
must pass afterward; the original failure remains recorded.
