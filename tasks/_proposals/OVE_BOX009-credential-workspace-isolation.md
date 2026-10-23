# OPEN: reconcile CLI credential volume scope with Workspace isolation

## Existing normative requirement and conflict

[ADR0020](../../docs/adr/0020-izolacja-macos-maszyna-wirtualna.md) requires persistent CLI
credential volumes to remain invisible to other Workspaces. Architecture section 12,
SEC001 section 5.4 SR-33 and the [requirements register](../../docs/security/requirements.md)
retain that boundary. SPECIFICATION section 10's optional isolated-Workspace knowledge
sharing flag does not authorize sharing credential files or CLI transcripts.

[BOX009](../OVE_BOX009/TASK.md) sections 3, 5.2, 5.3 and 9 currently specify one `cli` volume
per installation by default, forcing `cli-workspace` only for isolated Workspaces.
The task itself records that the shared volume exposes another Workspace's CLI
transcripts. Its existing default cannot verify the unconditional ADR0020/SR-33
boundary. This allocation conflict remains OPEN; no runtime control is claimed verified.

## Finite proposed alignment through the existing owner

The integrator should reconcile BOX009's existing scope policy to separate volumes
by CLI and Workspace for every Workspace, including ordinary Workspaces. Recommend
`cli-workspace` as the default and enforced resolution, without a shared `cli` mode
that bypasses the boundary. Preserve one matching CLI mount only, no credential
read/copy/export API, idempotent creation, metadata-only inspection, audit and
single-use Owner-approved deletion only when unmounted.

Retain BOX009's existing no-migration behavior: create a new scoped volume and ask
the Owner to log into the official CLI again. Do not inspect or copy old credentials;
any old-volume deletion keeps its existing approval and mount-use checks.

Use the existing BOX009 unit/fake-runner and real macOS persistence integration
allocation to verify distinct volumes for two ordinary Workspaces as well as
isolated Workspaces, matching-CLI mounts, denied cross-Workspace mounting and
unchanged no-read/deletion behavior. TEST007 retains real cross-Workspace denial
and release-isolation evidence; neither proposed tests nor fake CLIs prove it.

## Limits and current state

This documentation proposal changes no BOX009 TASK, runtime, API, dependency,
permission, architecture, security policy, CI or test budget. The owning task and
integrator must review and apply the finite alignment before runtime acceptance.
SR-33 stays MUST. Provider terms, physical escape evidence, residual-risk decisions,
parent SEC001 acceptance and release permission remain OPEN/separate.
