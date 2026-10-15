# Trusted isolation admission — OVE_SETUP006

Status: accepted by the Owner on 2026-10-15 through OVE_SETUP006-acceptance-sequence.md.

A pull_request workflow definition comes from PR-controlled YAML. Checking out a base-branch script does not make the already selected YAML trusted, and an attacker could remove the hosted gate. A workflow_run handler would select the default-branch definition, but the required zizmor audit rejects that trigger as high severity.

The implementation therefore keeps PR/merge-group events hosted-only and uses explicit maintainer workflow_dispatch from the default branch for PR isolation. The maintainer supplies the PR number; the gate verifies same-repository ownership, current head, successful hosted CI, writer permissions and fresh run-isolation plus isolate-<SHA> labels. Trusted default-branch pushes can run automatically. The high-severity audit is not disabled.

OVE_SETUP021 must also restrict runner access to the trusted workflow (organization runner group or private coordinator) and ensure ephemeral disposal. This personal repository has no registered runner. No unrestricted runner is installed by this task.

The Owner accepted this trigger adaptation for foundation CI. Real escape harness execution still requires OVE_TEST007 and restricted provisioning by OVE_SETUP021. The license policy remains unchanged; the license conflict was resolved through compatible tooling replacements, without exceptions.
