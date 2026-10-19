# OVE_ARCH033: keep the engine test command current

The integrator should replace only the command path on `apps/engine/README.md:12`
from `apps/engine/test/process.int.test.ts` to `tools/build/engine/process.int.test.ts`.
The old suite is removed by this task; preserve every other README byte.

Exact README SHA256: before `65a60963305574502fb5ab46658b03ae9cb9ed2ea40dd6a7500bd97d46796388`,
after `6e4dc068b2cb4138fa7a63baac2ca3e0a364b683081a4d7ace27cef92efff7b9`.

The actual moved public command passed all15 cases at native source `290cc53c36e05266a6f10fa2dbf6516831b32023`
with the same test bytes now committed as `d7ab4f189cf5f0d3ebd9101b2541df7cf9ccf136`.
Evidence: `/private/tmp/ove033-native2-20261019.json` SHA256 `f6e1ac61d5018e9e02a88308310a43213744a8ee757f27c0a33153650fa0b4d2`.
This proposal grants no product, dependency, policy or parent acceptance change.
