# Trusted isolation admission — OVE_SETUP006

Status: proposed; task 006 and merge remain blocked.

A pull_request workflow definition comes from PR-controlled YAML. Checking out a base-branch script does not make the already selected YAML trusted, and an attacker could remove the hosted gate. A workflow_run handler would select the default-branch definition, but the required zizmor audit rejects that trigger as high severity.

The implementation therefore keeps PR/merge-group events hosted-only and provisionally uses explicit maintainer workflow_dispatch from the default branch for PR isolation. The maintainer supplies the PR number; the gate verifies same-repository ownership, current head, successful hosted CI, writer permissions and fresh run-isolation plus isolate-<SHA> labels. Trusted default-branch pushes can run automatically. The high-severity audit is not disabled.

OVE_SETUP021 must also restrict runner access to the trusted workflow (organization runner group or private coordinator) and ensure ephemeral disposal. This personal repository has no registered runner. No unrestricted runner is installed by this task.

Review must decide this trigger adaptation before task 006 can be called complete. Real escape harness execution also requires OVE_TEST007. This proposal does not change the Owner's decision to keep the license policy and merge block.
