# Documentation CLI startup repair: finite integrator allocation

## Problem and scope

The retained ARCH060 native run 40215306984 failed 122/123: the public plugin add/remove case exceeded its unchanged 5000 ms test deadline at 5031.715 ms. Four single-command controls took 1.85-2.62 s. Another digest-verified cohort with the same tool sources and runtime passed that case in 2543.454 ms. The failed cohort remains failed; no rerun is substituted for it.

The Owner delegated routine blocking implementation choices. Root applies this finite completed-ARCH050 tooling correction separately from ARCH060. Only `tools/docs-check/registry.int.test.ts` and this proposal are allocated. Do not reclaim or finish ARCH050 again. The previous similarly named branch was already merged as PR1042 and is preserved. This distinct branch is `codex/docs-cli-native-manager`.

## Implementation

Select the canonical regular-file package-manager entry from the running pinned pnpm environment, failing closed if unavailable. Run its actual public `check:docs` script on every invocation. This trusts the active runner environment, as the previous PATH/Corepack selection did; it does not authenticate arbitrary executable provenance.

Give these child processes a Node compile cache under their unique temporary fixture. This caches compiled module code, not plugin discovery, registry generation, execution, output or test results. All three fresh processes still run, and every existing add/remove/denial assertion remains. Fixture cleanup removes the cache. Preserve an inherited `NODE_DISABLE_COMPILE_CACHE`; when `NODE_V8_COVERAGE` is present, disable child caching so deserialized functions do not reduce coverage precision. The pinned Node 22.23.3 supports this mechanism: https://nodejs.org/download/release/v22.23.3/docs/api/module.html#module-compile-cache.

No dependency, license exception, runtime installation, production change or control relaxation is introduced. Preserve all 123 native case identities and 30 files, 5000 ms test and 10000 ms child budgets, worker bounds, retry zero, public command count, flags, Git isolation and all existing assertions.

## Actual diagnosis retained

A private original-source single-case diagnostic passed in 2701.780 ms; four other cases were deliberately filtered and are not accepted as passed. A bare-startup pair measured Corepack at 130.998 ms and the exact active pnpm-native at 21.606 ms, both pnpm 12.11.2 on Node 22.23.3. This is one local pair, not a hosted speed guarantee.

The first native-manager candidate then failed the real eight-case focused suite: seven passed and the add/remove case exceeded 5000 ms at 6413 ms. The CPU coordinator already limited Vitest to one worker; a previous two-worker explanation was incorrect. This failure remains recorded.

A private diagnostic with that candidate retained per-phase events and original assertions: one selected case passed in 3079 ms, with CLI phases 1267/849/824 ms. Adding only a fixture-local compile cache in a separate diagnostic passed the same case in 2133 ms, with CLI phases 1146/443/393 ms and 368 cache entries. Both diagnostics filtered four cases; neither replaces the required full eight-case suite or hosted acceptance. They justify the cache implementation without raising limits.

## Acceptance still required

Run broad typecheck and lint before the actual eight public/Git-environment cases, then the current full suite and applicable security checks. Require independent whole Standards and Spec reviews on the exact rebased head. The changed integration-test source alters one of the 37 native source pins, so obtain both finite admissions for a new exact inventory before accepting a hosted artifact. Case identities and files remain unchanged. Require exact-head first-attempt hosted evidence, an ordinary merge into DEVELOP and actual post-merge checks. No hardware, application penetration test or release acceptance is claimed.
