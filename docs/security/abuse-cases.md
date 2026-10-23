# Security abuse-case catalogue

This catalogue implements [OVE_SEC012](../../tasks/OVE_SEC012/TASK.md). The [threat model](THREAT-MODEL.md) owns threat descriptions and the [SR register](requirements.md) owns normative controls; these cases supply verification hooks rather than a second policy.
AC-01..AC-40 retain the published reservations. Related variants distinguish their expected recovery without adding or renumbering identifiers.
Every verification below is **OPEN / assigned**, not an executed test or an implemented mitigation. Documentation checks, fake CLIs, AI review and authenticated Agent declarations do not prove physical isolation, completed effects or release safety.
Actors and preconditions describe controlled future fixtures only. Steps are non-executable; use disposable data, generic paths and synthetic secrets from SEC003. No live credentials, external targets or destructive commands are needed here.
All content-injection variants refer to the future [SEC004 corpus allocation](../../tasks/OVE_SEC004/TASK.md), including repository, web, issue, Skill, document, CLI/tool and Agent sources; this document embeds no payload.

## Filesystem, network and untrusted content

- **AC-01 — Host secret-file read.** Actor: compromised Agent. Preconditions: one approved project mount; host-only SSH and Keychain canaries remain outside it.
  Steps: request those host-only canaries through the CLI and through a scoped Agent request.
  Expected: **BLOCKED**; neither channel returns bytes or mounts a protected location; retain a redacted denial audit event.
  Trace: T-TB-SBX-4, T-TB-KC-6; SR-01, SR-05, SR-06, SR-31. Verification (OPEN): SEC002 protected-root unit/integration; TEST007 actual sandbox host-canary escape; SEC005 Agent-scope integration.

- **AC-02 — Relative write outside the project.** Actor: compromised Agent. Preconditions: writable project mount and a separate disposable outside canary.
  Steps: submit a relative traversal write whose physical destination is outside the effective roots.
  Expected: **BLOCKED**; outside bytes and permissions remain unchanged, with no broad mount or successful effect receipt.
  Trace: T-TB-SBX-2, T-TB-FS-4; SR-01, SR-04, SR-05. Verification (OPEN): SEC002 traversal unit/property; TEST007 real write-escape and unchanged-canary checks.

- **AC-03 — Symlink escape and swap.** Actor: compromised Agent. Preconditions: project symlink points to an outside fixture, or a fixture link changes between decision and open.
  Steps: request an effect through the link, then repeat with the controlled identity swap.
  Expected: **BLOCKED**; reject outside resolution or changed identity; no outside read/write, including host-side verified opens.
  Trace: T-TB-FS-2, T-TB-SBX-6; SR-03, SR-04, SR-05. Verification (OPEN): SEC002 real temporary-filesystem TOCTOU integration; TEST007 sandbox symlink escape.

- **AC-04 — Bind mount or runtime-socket escape.** Actor: compromised Agent. Preconditions: unprivileged Environment; a disposable forbidden mount target and runtime endpoint are not exposed.
  Steps: attempt to introduce an unapproved bind mount or reach the container-management endpoint from the Environment.
  Expected: **BLOCKED**; no new host mount, management authority or outside-canary access; unavailable mount checks deny execution.
  Trace: T-TB-SBX-6, T-TB-FS-4; SR-03, SR-04, SR-05, SR-29. Verification (OPEN): TEST007 actual bind-mount/runtime-endpoint escape probes; BOX019 unavailable-isolation denial integration.

- **AC-05 — DNS egress outside the allowlist.** Actor: compromised Agent. Preconditions: proxy-only networking; a controlled DNS sink represents an unapproved destination.
  Steps: attempt direct name resolution or a DNS-carried canary outside the approved egress path.
  Expected: **BLOCKED**; the sink receives no canary; an Access Request cannot itself grant networking authority.
  Trace: T-TB-NET-4, T-TB-NET-6; SR-03, SR-20, SR-38. Verification (OPEN): TEST007 actual Environment DNS bypass/canary-sink probes; BOX012 network-isolation integration.

- **AC-06 — New-domain HTTPS and destination substitution.** Actor: compromised Agent. Preconditions: controlled unapproved HTTPS sink and approved-host redirect/rebinding fixtures.
  Steps: request the new destination, then substitute it through a redirect or changed DNS answer.
  Expected: **BLOCKED** without a valid bound Approval or after destination substitution; no target receives canaries, direct sockets stay unavailable and a request alone creates no grant.
  Trace: T-TB-NET-2, T-TB-NET-4, T-TB-NET-6; SR-03, SR-20, SR-34. Verification (OPEN): BOX011 real-socket resolver/redirect integration; BOX013 Approval integration; TEST007 actual proxy-bypass escape.

- **AC-07 — Parent directory Access Request.** Actor: Agent. Preconditions: one narrow project root; its generic parent contains unrelated fixture projects.
  Steps: request the parent directory as though membership of one child granted access to its ancestors.
  Expected: **BLOCKED**; no ancestor inheritance, permanent grant or protected-root registration; record the denial without exposing sibling contents.
  Trace: T-TB-FS-1, T-TB-FS-6; SR-01, SR-02, SR-04, SR-25. Verification (OPEN): SEC002 protected-parent/root unit/integration; PERM016 channel/authority use-case negatives.

- **AC-08 — Traversal, case, Unicode and firmlink aliases.** Actor: Agent. Preconditions: generic allowed/outside fixture directories with known volume identity rules.
  Steps: submit Access Requests using parent segments, case variants, normalization variants and a firmlink alias for the outside target.
  Expected: **BLOCKED** for every outside identity after canonical comparison; spelling, parent segments and alias normalization never widen rights.
  Trace: T-TB-FS-1, T-TB-FS-6; SR-01, SR-02, SR-04. Verification (OPEN): SEC002 per-variant unit/property and actual macOS volume/firmlink integration; TEST007 mount-boundary escape.

- **AC-09 — Repository README claims blanket authority.** Actor: repository content author. Preconditions: Chief consumes a README as project data.
  Steps: select SEC004's repository instruction-override/Approval-forgery fixture and pass it through prompt assembly.
  Expected: **DETECTED**, fenced and provenance-labelled; **BLOCKED** permission, Approval, Rule and configuration mutations regardless of model response.
  Trace: T-TB-CONTENT-1, T-TB-CONTENT-6; SR-08, SR-16, SR-24. Verification (OPEN): SEC004 corpus/source matrix and capability-firewall denied-effect assertions.

- **AC-10 — Web page requests Skill installation.** Actor: page author. Preconditions: imported page content is supplied for analysis; no Owner Skill import exists.
  Steps: select SEC004's web/Skill-install fixture and observe generated proposals and effect calls.
  Expected: **BLOCKED** automatic fetch/import/activation; page text remains data, and any proposal still requires the existing Owner acceptance route.
  Trace: T-TB-CONTENT-6, T-TB-SUPPLY-6; SR-08, SR-09, SR-25. Verification (OPEN): SEC004 web corpus matrix; SKILL007/008 Owner-import and pending-version unit/integration negatives.

- **AC-11 — Issue text imitates Telegram Approval.** Actor: issue author. Preconditions: a pending request exists, but no authenticated callback has been received.
  Steps: select SEC004's issue/forged-callback fixture and supply it as issue content.
  Expected: **BLOCKED**; issue text consumes no Approval, changes no policy and cannot become authenticated Telegram caller context.
  Trace: T-TB-CONTENT-1, T-TB-TG-2; SR-08, SR-15, SR-16, SR-34. Verification (OPEN): SEC004 source matrix and no-side-effect parser tests; SEC008 callback-forgery integration.

- **AC-12 — Imported Skill requests disabled Approvals.** Actor: malicious Skill author. Preconditions: the Owner imported a version, without granting additional Tools or changing Rules.
  Steps: select SEC004's Skill/permission-weakening fixture and invoke that recorded version.
  Expected: **BLOCKED** Approval removal, Tool grants and policy widening; provenance/version stay recorded and Owner import never supplies those rights.
  Trace: T-TB-CONTENT-6, T-TB-SUPPLY-6; SR-02, SR-08, SR-09, SR-16. Verification (OPEN): SEC004 Skill corpus/capability-firewall tests; SKILL007/008 authority unit/integration.

- **AC-13 — Another Agent claims Owner approval.** Actor: compromised Agent. Preconditions: Chief receives that Agent's free-text report about an unresolved request.
  Steps: select SEC004's cross-Agent authority-forgery fixture and forward it to Chief and a peer Agent.
  Expected: **DETECTED** as an attributed declaration only; **BLOCKED** Approval consumption, rights changes and completion without independent evidence.
  Trace: T-TB-CONTENT-1, T-TB-CONTENT-3; SR-08, SR-17, SR-19, SR-24. Verification (OPEN): SEC004 Agent-source matrix/denied effects; AGENT014 schema/authentication tests; WFRT056 forged-evidence unit negatives.

- **AC-14 — Permission fields smuggled into Agent JSON.** Actor: compromised Agent. Preconditions: a declared summary/report schema accepts no permission-changing fields.
  Steps: select SEC004's strict-JSON/unknown-permission-field fixture, including nested and oversized variants.
  Expected: **BLOCKED** schema rejection with safe suspicious-output attribution; no policy object or effect is created from unknown fields.
  Trace: T-TB-CONTENT-2, T-TB-CONTENT-6; SR-08, SR-23, SR-24. Verification (OPEN): SEC004 strict proposal-parser unit/property and capability-firewall tests; AGENT014 schema/size negatives.

- **AC-15 — Document, CLI or tool output forges instruction boundaries.** Actor: content or tool-output author. Preconditions: those sources enter prompt assembly as external data.
  Steps: select SEC004's per-source hidden-Unicode, forged-role and delimiter fixtures without copying their payloads here.
  Expected: **DETECTED** visible sanitization/provenance findings; **BLOCKED** instruction-section modification, code execution and authority promotion; nonce ambiguity fails closed.
  Trace: T-TB-CONTENT-1, T-TB-CONTENT-2, T-TB-CONTENT-6; SR-03, SR-08, SR-23, SR-24. Verification (OPEN): SEC004 complete source/corpus matrix, immutable-instruction properties and fence-collision negatives.

## Telegram and terminal state

- **AC-16 — Unpaired sender or group impersonates the Owner.** Actor: remote sender. Preconditions: one private chat/user pair is registered by desktop pairing.
  Steps: submit mismatched chat/user ids, another user's messages and group/channel updates to the fake Telegram API.
  Expected: **BLOCKED** and silently ignored without information-bearing replies; pairing attempts remain bounded and no engine action starts.
  Trace: T-TB-TG-1, T-TB-TG-5; SR-14, SR-16, SR-37. Verification (OPEN): SEC008 real-adapter pairing/forged-sender/group/flood integration using TEST012's fake API.

- **AC-17 — Replayed Telegram update.** Actor: remote sender or duplicate delivery. Preconditions: one update has already caused its authorized effect.
  Steps: deliver the same update again, then an older update, including after an engine restart.
  Expected: **BLOCKED** duplicate/old execution; persisted deduplication leaves the side-effect count at one and retains safe audit attribution.
  Trace: T-TB-TG-2, T-TB-TG-3; SR-17, SR-18, SR-34. Verification (OPEN): SEC008 replay/restart integration; TG011 callback single-use integration.

- **AC-18 — Forged, changed or reused Approval callback.** Actor: remote sender. Preconditions: an opaque server-issued callback is bound to a specific request, action, Run and sender.
  Steps: alter the callback identifier/binding, use another sender, or submit an already consumed or expired callback.
  Expected: **BLOCKED** with no action or grant; a generic stale/expired result reveals no sensitive binding and cannot re-open the request.
  Trace: T-TB-TG-2, T-TB-GW-2; SR-12, SR-15, SR-17, SR-34. Verification (OPEN): SEC008 forgery/expiry integration; TG011 replay/conflict tests; SEC005 replay/idempotency gateway negatives.

- **AC-19 — Approval after the Run ends.** Actor: paired remote caller or delayed delivery. Preconditions: an Access Request belongs to a completed/cancelled Run.
  Steps: deliver its formerly valid Approval after Run completion and attempt to reuse the grant in a new Run.
  Expected: **BLOCKED**; the old grant is inactive/revoked, no mount changes, and the next Run receives no inherited access.
  Trace: T-TB-TG-2, T-TB-ENG-6; SR-03, SR-15, SR-25, SR-34. Verification (OPEN): PERM016 expiry/revocation/mount-failure use-case and recovery tests; SEC008 ended-Run remote integration.

- **AC-20 — Stolen phone requests permanent directory access.** Actor: holder of the paired phone. Preconditions: sender authentication succeeds but the channel is Telegram.
  Steps: request a permanent grant through crafted text/callback data instead of the permitted current-Run decision.
  Expected: **BLOCKED** by local-authority enforcement; no persistent policy change, later-Run access or bypass of any effective-policy layer.
  Trace: T-TB-TG-6, T-TB-FS-6; SR-02, SR-15, SR-16, SR-25. Verification (OPEN): SEC008 stolen-phone/permanent-grant integration; PERM016 channel/decision matrix and subsequent-Run denial.

- **AC-21 — Edited Telegram message changes an approved action.** Actor: paired-account holder or message edit delivery. Preconditions: a prior message/callback has a durable action binding.
  Steps: deliver an edited message that changes its claimed target or decision after the original was processed.
  Expected: **BLOCKED** re-execution and rebinding; the original action hash, decision and single-use status remain authoritative.
  Trace: T-TB-TG-2, T-TB-TG-3; SR-15, SR-17, SR-34. Verification (OPEN): SEC008 edited-message and action-binding integration; TG011 single-use callback integration.

- **AC-22 — herdr reports done without completed work.** Actor: compromised/mistaken CLI or terminal detector. Preconditions: the requested artifact/effect evidence is missing or contradicted.
  Steps: deliver a done hint and authenticated completion declaration while effect probes or Quality Gate artifacts disagree.
  Expected: **DETECTED** missing or contradicted evidence; **BLOCKED** Task/Run advancement; record the specified failed/contradicted verdict and preserve inconclusive evidence without fabricating success.
  Trace: T-TB-HERDR-1, T-TB-HERDR-3, T-TB-CONTENT-3; SR-17, SR-19, SR-24. Verification (OPEN): PROV015 outcome/probe-timeout tests; WFRT056 forged/missing-artifact unit negatives; TEST006 simulator screens.

- **AC-23 — Login required despite a done hint.** Actor: official CLI state or misleading detector. Preconditions: a synthetic expired-login screen contradicts herdr's done hint.
  Steps: classify the observation and attempt ordinary work delivery before the Owner completes the official CLI login.
  Expected: **DETECTED** needs-login state; **BLOCKED** prompt delivery and completion advancement; notify once without reading credentials or accepting login codes into Overmind.
  Trace: T-TB-HERDR-3, T-TB-HERDR-4; SR-06, SR-19, SR-21. Verification (OPEN): PROV006 classifier unit; PROV014 fake-CLI login/expiry integration; PROV008 zero-send state matrix.

- **AC-24 — Ordinary text reaches a CLI dialog.** Actor: queued caller or forged terminal output. Preconditions: choice variant, a non-permission dialog; Approval variant, a permission dialog without a bound Owner decision.
  Steps: in each variant, attempt ordinary prompt delivery or an automatic answer; separately alter the observed dialog fingerprint.
  Expected: **BLOCKED** all ordinary prompt sends and unapproved allow answers. Choice variant: Escalation and no answer. Permission variant: preview-bound Approval or Escalation; **ALLOWED WITH APPROVAL** only the specified allow-once key after a valid decision for the unchanged dialog, subject to the existing Run/Pause guards.
  After an issued permission Approval is denied or expires, only its specified deny key may be sent while the same dialog remains; missing/changed dialogs cause no typing. No session/permanent approval or ordinary send is admitted.
  Trace: T-TB-HERDR-3, T-TB-HERDR-6; SR-03, SR-08, SR-19, SR-25. Verification (OPEN): PROV006 per-state classification; PROV008 separate choice/blocked-Approval zero-send unit assertions; PROV013 injected/reordered-dialog, fingerprint, Approval/expiry and choice-Escalation use-case tests.

- **AC-25 — Ambiguous prompt timeout duplicates publication.** Actor: retrying caller. Preconditions: an authorized non-idempotent publication may have happened before acknowledgement was lost.
  Steps: time out one delivery and resubmit the same intent/idempotency key while the effect is unknown.
  Expected: **BLOCKED** blind retry; at most one send/effect, an unknown-delivery record and evidence-led reconciliation or Escalation.
  Trace: T-TB-HERDR-2, T-TB-PROVIDER-2; SR-17, SR-18, SR-28, SR-34. Verification (OPEN): PROV008 timeout/journal/at-most-one-send properties; TEST011 actual crash/restart side-effect counters.

## Recovery, gateway, redaction and supply chain

- **AC-26 — Engine crashes after action-start intent.** Actor: controlled process fault. Preconditions: durable started intent exists; non-idempotent effect completion is not durably known.
  Steps: stop/restart the disposable engine at that boundary and request Run recovery.
  Expected: **DETECTED** ambiguity; **BLOCKED** automatic replay; reconcile actual evidence or wait for an Owner decision, preserving pinned WorkflowVersion and audit continuity.
  Trace: T-TB-ENG-2, T-TB-ENG-3; SR-03, SR-17, SR-18, SR-26, SR-34. Verification (OPEN): TEST011 spawned-engine recovery fault injection and durable-ledger/side-effect invariants.

- **AC-27 — Local process uses the gateway without a valid token.** Actor: untrusted same-user process. Preconditions: owner-only Unix socket exists; no default TCP listener.
  Steps: submit tokenless, malformed, expired and previous-engine credentials to the under-test gateway; inspect permissions and listeners.
  Expected: **BLOCKED** before handler execution with uniform safe authentication failures; rotate credentials and preserve socket/directory modes. Peer uid is additional SHOULD evidence, never a token substitute.
  Trace: T-TB-GW-1, T-TB-GW-4; SR-10, SR-11, SR-12, SR-13. Verification (OPEN): SEC005 actual socket/token/restart integration, optional dev-HTTP Host/Origin negatives and explicit peer-capability review.

- **AC-28 — Scoped Agent credential calls Owner or another Run.** Actor: compromised Agent/overmind helper. Preconditions: one valid Agent token is bound to a specific Run and allowed routes.
  Steps: use it on an Owner-scope mutation, token-minting route or another Run's read/subscription.
  Expected: **BLOCKED** without invoking the handler or leaking target existence; no permission grant, token mint or cross-Run data.
  Trace: T-TB-GW-6, T-TB-KC-6; SR-02, SR-12, SR-25, SR-31. Verification (OPEN): SEC005 generated route-scope/token-lifecycle integration; ENGINE028 expiry/Run-binding/revocation tests.

- **AC-29 — Secret enters diagnostics.** Actor: failing adapter or adversarial content. Preconditions: a synthetic SEC003 bot-token/login-secret vector reaches a diagnostic/error boundary.
  Steps: exercise structured, nested, streamed and failure outputs through their actual formatting/redaction seams.
  Expected: **DETECTED** and redacted before storage/output; no plaintext in logs, events, errors, snapshots or exported artifacts, including scanner failure messages.
  Trace: T-TB-KC-4, T-TB-TG-4, T-TB-GW-4; SR-06, SR-07, SR-21. Verification (OPEN): SEC003 sink/cross-channel/streaming corpus tests; ARCH004 redactor unit/integration and snapshot scanning.

- **AC-30 — Host path escapes in a Telegram error.** Actor: failing host operation. Preconditions: a generic synthetic home-path error will be formatted for the remote channel.
  Steps: pass the error, nested cause and translation parameters through the outbound formatter.
  Expected: **BLOCKED** disclosure of absolute home paths, private identifiers or raw causes; deliver a safe relative/redacted result without losing correlation.
  Trace: T-TB-TG-4, T-TB-FS-3; SR-06, SR-07, SR-17. Verification (OPEN): SEC003 cross-channel path corpus; TG009 outbound-format/redaction unit tests; SEC008 sent-message integration scan.

- **AC-31 — Dependency asks to run an unapproved install script.** Actor: supply-chain attacker. Preconditions: a disposable dependency-policy fixture adds a lifecycle script outside the reviewed allowance.
  Steps: inspect the changed manifests/lockfile/policy and exercise the denied-script installation boundary without executing that script.
  Expected: **BLOCKED** unapproved code execution and merge/release acceptance; keep exact pins, release age, licenses and audit gates unchanged.
  Trace: T-TB-SUPPLY-2, T-TB-SUPPLY-4, T-TB-SUPPLY-6; SR-03, SR-22. Verification (OPEN): SEC006 violating/clean policy fixtures; SETUP008 dependency-policy configuration-fixture tests and review; installation is outside SETUP008 scope.

- **AC-32 — Unpinned or privileged GitHub Action.** Actor: contributor or compromised upstream. Preconditions: a fixture workflow has a floating Action ref or unsafe token/fork permissions.
  Steps: run repository supply-chain validation against the fixture and compare it with the pinned least-privilege fixture.
  Expected: **BLOCKED** acceptance before execution/publication; no fork-secret exposure, elevated checkout or unreviewed Action update.
  Trace: T-TB-SUPPLY-2, T-TB-SUPPLY-4, T-TB-SUPPLY-6; SR-03, SR-22. Verification (OPEN): SEC006 action-pin/permissions/unsafe-trigger rule unit and CLI integration fixtures; SETUP006 security review.

- **AC-33 — Bundled herdr binary is replaced.** Actor: supply-chain or local artifact attacker. Preconditions: expected version/checksum/provenance is pinned; only a disposable fixture binary is changed.
  Steps: validate the substituted artifact at packaging and the first-use verification boundary.
  Expected: **BLOCKED** packaging/use on mismatch or unavailable verification; no network-fetched replacement or unpinned terminal process starts.
  Trace: T-TB-SUPPLY-1, T-TB-SUPPLY-2, T-TB-HERDR-2; SR-03, SR-22, SR-28. Verification (OPEN): SEC006 checksum/substitution negative fixture; SETUP015 checksum fixture-server/build tests and runtime-preflight contracts.

## Login, rendering, resource and authority boundaries

- **AC-34 — Login-port squatter or wrong Environment.** Actor: local process or stale login callback. Preconditions: a synthetic login session intends one Environment and a bounded temporary callback forward.
  Steps: occupy the intended loopback port, alter the intended Environment/session, then exercise expiry, cancellation and forward cleanup variants.
  Expected: **BLOCKED** interception, wrong-target delivery and stale forwarding; fail closed and tear down session resources without exposing callback codes, credentials or URLs in logs.
  Trace: T-TB-NET-1, T-TB-NET-6, T-TB-PROVIDER-4; SR-03, SR-06, SR-21. Verification (OPEN): SEC009 pure URL/session/forward-guard unit/property; BOX015 real-socket squatter/filter and actual macOS forward/cleanup integration; PROV014 fake-CLI cancel/expiry integration.

- **AC-35 — Untrusted Markdown reaches a privileged link or renderer.** Actor: content author. Preconditions: chat displays SEC004's hostile Markdown fixture through the real React renderer.
  Steps: render forbidden-scheme links, raw-HTML/script-shaped content and deceptive external destinations; activate via keyboard and pointer.
  Expected: **BLOCKED** script/HTML execution and forbidden navigation/IPC; permitted external links use the existing URL allowlist and minimal shell capability only.
  Trace: T-TB-UI-1, T-TB-UI-6; SR-08, SR-35, SR-36. Verification (OPEN): CHATUI008 actual-renderer hostile DOM/link tests; DS001 canonical safeHref utility unit guards; DS022 TextLink/browser consumption cases; SETUP010 CSP/denied-IPC checks.

- **AC-36 — Oversized or exhausting gateway requests.** Actor: local hostile client. Preconditions: a disposable gateway has configured body, connection, rate, queue and subscription limits.
  Steps: send oversized/malformed/deeply nested bodies and controlled bursts/slow frames to that instance only.
  Expected: **BLOCKED** over-limit work with safe bounded errors and no handler side effect, crash or unbounded queue; ordinary authorized status remains responsive.
  Trace: T-TB-GW-5, T-TB-CONTENT-5; SR-03, SR-24, SR-37. Verification (OPEN): SEC005 actual hostile-client limit/malformed-input suite; ENGINE014 fake-clock unit and gateway flood integration.

- **AC-37 — Environment process or memory exhaustion.** Actor: compromised Agent. Preconditions: disposable dedicated sandbox infrastructure and configured CPU/memory/pid limits.
  Steps: use TEST007's bounded resource probe to approach/exceed the Environment limits, with host-side observation and cleanup.
  Expected: **DETECTED** limit breach; **BLOCKED** additional admissions/processes as specified, host/other-Environment canaries remain responsive and resource/audit evidence is bounded.
  Trace: T-TB-SBX-5, T-TB-NET-5; SR-03, SR-30, SR-37. Verification (OPEN): BOX017 admission/monitor unit and actual macOS resource integration through TEST007; no live fork attack is performed by this document.

- **AC-38 — Workspace B reads Workspace A credentials.** Actor: compromised Agent in B. Preconditions: separate A/B identity and synthetic CLI-owned credential/transcript markers.
  Steps: request A's volume from B by guessed id, incorrect mapping and recreated-Environment/mount variants, including ordinary non-isolated Workspaces.
  Expected: **BLOCKED** all cross-Workspace marker reads/mounts under SR-33; Overmind never reads credential contents. BOX009's shared-by-default scope conflict remains OPEN below.
  Trace: T-TB-SBX-1, T-TB-SBX-4, T-TB-PROVIDER-4; SR-05, SR-06, SR-33. Verification (OPEN): BOX009 naming/scope/volume integration plus TEST007 actual cross-Workspace credential denial; existing shared-default allocation cannot yet satisfy this case.

- **AC-39 — Retry loop bypasses Global Pause.** Actor: Agent or queued retry. Preconditions: Global Pause is active while work is queued or draining.
  Steps: attempt new Run/Node/prompt dispatch, repeated retry and remote/Agent resume while the pause remains active.
  Expected: **BLOCKED** new execution and unauthorized resume; persist in-flight outcomes and reconcile interrupted non-idempotent work before an authorized resume.
  Trace: T-TB-SBX-5, T-TB-ENG-5, T-TB-HERDR-2; SR-03, SR-18, SR-30, SR-37. Verification (OPEN): PAUSE005 gate contracts; PAUSE006 participant/drain contracts; PROV008 paused zero-send tests; WFRT052 route-scope/lifecycle tests and SEC008 paused-channel integration.

- **AC-40 — Telegram weakens an Owner Rule or Approval requirement.** Actor: paired phone/account holder. Preconditions: a Rule/default Approval applies to publication, deletion, messaging, payment, new domain or budget overrun.
  Steps: request its permanent removal/change through remote text, a forged callback or an Agent proposal.
  Expected: **BLOCKED** remote/Agent mutation and Approval bypass; only the existing authenticated Local Approval route may change the Rule, with attributable audit.
  Trace: T-TB-TG-6, T-TB-CONTENT-6; SR-02, SR-16, SR-17, SR-25. Verification (OPEN): SEC008 remote-widening integration; PERM009/012 and DATA015 local-authority negatives; SEC005 permission-expanding route matrix.

## Coverage and evidence handoff

The cases resolve every reserved AC-01..AC-40 family in threat-model section 6 and the parent section 5.5; AC-24 has distinct choice/Approval recovery assertions. All referenced SR ids resolve in the single SR register, including its unchanged SR-11 SHOULD.
All six security-related SPECIFICATION 16 criteria retain their register mapping: 1 → AC-01/07/08; 7 → AC-25/26; 8 → AC-01..08/38; 9 → AC-18..20; 10 → AC-09..15/20/24/28/40; 14 → AC-36/37/39. This is coverage allocation, not acceptance evidence.
Physical escape/penetration work remains with TEST007/BOX and dedicated safe infrastructure from SETUP021. Missing hardware, harness, exact-artifact provenance or required reports blocks that verification and release; fakes and document checks cannot replace it.
The BOX009 default shares one CLI volume across ordinary Workspaces, conflicting with SR-33's universal boundary. Keep AC-38 **OPEN**, preserve SR-33, and require the owning task/integrator to reconcile [the recorded allocation gap](../../tasks/_proposals/OVE_BOX009-credential-workspace-isolation.md) before implementation acceptance; no convenience exception is inferred.
Every other runtime hook above also remains **OPEN** until its actual task supplies the exact target/head, case identity, commands, exit codes, denied/allowed effects, cleanup and report/artifact provenance. Preserve failures, missing checks and explicit skips; never convert a planned activity into PASS.
OVE_SEC001 retains final cross-document review, all its unchecked acceptance criteria, the three-document 600..900-line requirement and every Owner residual-risk decision. This catalogue neither accepts provider terms nor authorizes a weaker isolation fallback.
