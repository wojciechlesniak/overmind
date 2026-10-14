# Proposal from OVE_NOTIF008: named sound on the Notifier port

Target task: OVE_ARCH012 (owner of `packages/application/src/ports/Notifier.ts`).

Change (additive only): `notify(n)` accepts an optional `soundName?: SoundId` (allowlist from `packages/contracts/src/notification-sound/`), and `capabilities()` gains `namedSounds: boolean`. Existing `sound?: 'default'|'none'` stays. Implementations that cannot play a named sound use `default`.

Reason: Access Request and Approval signals use `Glass` and `Ping` (OVE_NOTIF008); the allowlist prevents platform-call injection.
