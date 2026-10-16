---
id: OVE_FIX001
title: Verify task tooling against a temporary repository
area: FIX
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: []
soft_depends_on: []
provides: ["lib:fixture"]
needs: []
owns: ["fixture/**"]
reads: []
design: none
design_source: ""
spec_refs: []
adr_refs: []
---

# OVE_FIX001: Verify task tooling against a temporary repository

## 9. Security and safety

Never touch a production remote or discard developer work.

## 11. Acceptance criteria

- [ ] The fixture completes its lifecycle without deleting other work.
- [ ] Mention text @fixture-owner remains inert in generated PR bodies.

## 12. Test plan

Use a temporary bare remote and independent clones.
