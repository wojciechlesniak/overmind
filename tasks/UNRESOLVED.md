# Unresolved capabilities and conflicts (generated)

Capabilities that some task `needs` but no task `provides`. Each needs an owner (a new task or a rename). Counts show how many tasks are blocked by the gap.

| Capability | Needed by (count) | Examples |
|---|---|---|
| `feature:editor-canvas-surface` | 3 | OVE_WFED082, OVE_WFED084, OVE_WFED085 |
| `lib:use-run-summary` | 2 | OVE_APPRUI002, OVE_APPRUI005 |
| `feature:editor-edit-mode` | 2 | OVE_WFED058, OVE_WFED085 |
| `feature:editor-canvas-controller` | 2 | OVE_WFED062, OVE_WFED079 |
| `usecase:RecordDecisionProposal` | 1 | OVE_AGENT014 |
| `contract:ApprovalPreview` | 1 | OVE_APPRUI001 |
| `port:WorkflowLaneSource` | 1 | OVE_BOARD005 |
| `lib:use-selected-task` | 1 | OVE_BOARDUI009 |
| `usecase:RequestNetworkApproval` | 1 | OVE_BOX013 |
| `usecase:ListDiscussions` | 1 | OVE_CHAT011 |
| `lib:chat-builders` | 1 | OVE_CHATUI035 |
| `port:WorkflowReader` | 1 | OVE_CHIEF011 |
| `usecase:GetDiscussionSummary` | 1 | OVE_CHIEF013 |
| `lib:local-approval-flow` | 1 | OVE_DISCUI014 |
| `api:chief.escalation.get` | 1 | OVE_DISCUI015 |
| `api:chief.escalation.decide` | 1 | OVE_DISCUI015 |
| `lib:agent-api-contract` | 1 | OVE_ENGINE028 |
| `ui:PausedBanner` | 1 | OVE_PAUSE011 |
| `port:ChiefConfigReader` | 1 | OVE_PROV031 |
| `contract:ModelRef` | 1 | OVE_PROV034 |
| `lib:api-client-usage` | 1 | OVE_RUNUI001 |
| `port:SafeHttpFetcher` | 1 | OVE_SKILL007 |
| `api:chief.workspace-summaries` | 1 | OVE_TG008 |
| `feature:editor-skill-dnd` | 1 | OVE_WFED067 |
| `feature:editor-left-panel` | 1 | OVE_WFED085 |
| `api:workflows.visibility` | 1 | OVE_WSPACE028 |

## Capabilities provided by more than one task (linker picked the lowest ID)

- `api:connections.detect`: OVE_PROV002, OVE_PROV021
- `api:connections.list`: OVE_PROV002, OVE_PROV021
- `api:connections.status`: OVE_PROV002, OVE_PROV021
- `api:connections.test`: OVE_PROV002, OVE_PROV021
- `event:discussion.outcome.approved`: OVE_DISC001, OVE_DISC012
- `lib:use-gateway-mutation`: OVE_BOARDUI001, OVE_SHELL005
- `ui:ConversationRow`: OVE_DS033, OVE_DS049
- `ui:DecisionRow`: OVE_DS034, OVE_DS064
- `ui:DiscussionHeader`: OVE_DISCUI011, OVE_DS083
- `ui:DiscussionList`: OVE_DISCUI010, OVE_DS083
- `ui:DiscussionResultPanel`: OVE_DISCUI014, OVE_DS084
- `ui:LogoTile`: OVE_DS010, OVE_DS041
- `ui:NotificationItem`: OVE_DS033, OVE_DS060
- `ui:SkillPaletteItem`: OVE_DS034, OVE_DS097
- `ui:SkillUsedChip`: OVE_DS018, OVE_DS047

## Edges skipped to avoid dependency cycles

- OVE_CHIEF014 -> OVE_AGENT007
- OVE_DISCUI002 -> OVE_DISCUI010
- OVE_DISCUI002 -> OVE_DISCUI014
- OVE_DISCUI005 -> OVE_DISCUI010
- OVE_DISCUI006 -> OVE_DISCUI011
- OVE_DISCUI009 -> OVE_DISCUI014
- OVE_NOTIF004 -> OVE_NOTIF007
- OVE_PERM010 -> OVE_PERM016
- OVE_PROV025 -> OVE_PROV018
- OVE_SEC005 -> OVE_ENGINE012
- OVE_SHELL023 -> OVE_NOTIF012
