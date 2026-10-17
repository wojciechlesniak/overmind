# Architecture documentation

Dependencies point inward: contracts, domain rules, application ports, then adapters and composition roots. Business rules remain independent of UI, filesystem and platform APIs.

| Document                                     | Purpose                                | Owner                     |
| -------------------------------------------- | -------------------------------------- | ------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md) — pending | Layers, dependencies and diagrams      | OVE_ARCH001               |
| Planned boundary guide                       | Import rules and proving fixtures      | OVE_ARCH002               |
| Planned contract pipeline                    | Additive schemas and generated clients | OVE_ARCH008 / OVE_ARCH009 |
| Planned error model                          | Typed Result boundaries                | OVE_ARCH003               |
| Planned ports guide                          | Dependency inversion and wiring        | OVE_ARCH006               |

Owners append one descriptive row per document. This index does not own the architecture document or its graph. See [the specification](../SPECIFICATION.md) for current requirements.
