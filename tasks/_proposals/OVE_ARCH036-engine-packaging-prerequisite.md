# Native packaging prerequisite for OVE_ARCH036

The actual full integration run at ARCH036 source 0efaff4 passed 109 cases and
failed the two existing macOS packaging cases. The signed relocated source-map
case stops at normal runtime preparation, before its own mapping assertions.
A focused rerun reproduced that failure; running the normal packager directly,
without Vitest, produced the same lifecycle-contract denial.

The verifier rejects every metafile input under engine compose/ or service/.
OVE_ARCH034 added the two tracked exact UNIMPLEMENTED=true foundation modules.
All packager, engine, bundler, lock and root-package inputs are unchanged from
DEVELOP 6bcd8a61d1d7911a91f7e567108d0d73b85c38bd. The three dispatch probes
used the same approved Node 22.23.3 executable. The 100 MB message is the existing
warning; the unchanged hard size limit is 150 MB.

[SETUP017](../OVE_SETUP017/TASK.md) permits stub exit 20 before ENGINE and requires
real signed verification. [ARCH034](../OVE_ARCH034/TASK.md) defines exact absent
foundation markers without implementing a service. The accepted
[packaging contract](OVE_SETUP017-packaging-contract.md) defers safe live startup
and bounded stop to the owning work. This is an existing contract mismatch,
not evidence that either native packaging check passed.

Request a finite owning repair that reconciles those existing contracts while
retaining rejection of unsupported live hooks and every original verification,
assertion and deadline. ARCH036 does not own the packager and applies no foreign
repair. Its integration acceptance remains blocked until that repair is reviewed,
integrated and the unchanged failing checks pass. No gate, capability, policy,
size limit, test deadline or retry exception is requested.

Current raw receipts and the unchanged-baseline file identities are retained in
the coordinator's durable operational evidence. The historical deleted logs are
not substituted for fresh execution.
