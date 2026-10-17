# Documentation

The specification and Owner Rules define the product. Some sources remain Polish until translation tasks complete; their presence is not an English publication claim.

<!-- docs-toc:start -->

- [Conventions](#conventions)

<!-- docs-toc:end -->

| Location                                                       | Purpose                                                               | Owner area       |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------- |
| [SPECIFICATION.md](SPECIFICATION.md)                           | Product, architecture and acceptance criteria                         | OSS / product    |
| [Current glossary](../GLOSSARY.md); planned `docs/GLOSSARY.md` | Domain terminology and bilingual glossary                             | OVE_OSS005       |
| [adr/](adr/); planned [ADR index](adr/README.md)               | Architecture decisions                                                | OVE_OSS006       |
| [architecture/](architecture/README.md)                        | Architecture and diagrams                                             | ARCH             |
| [security/](security/README.md)                                | Threat model, checklists and incident guidance                        | SEC              |
| [design/](design/)                                             | Visual style and sources                                              | OSS / DS         |
| [research/](research/)                                         | herdr, prototypes and packaging findings                              | SETUP / research |
| [engineering/](engineering/README.md)                          | CI, release, development, agents, settings, runners and bundled tools | SETUP / OSS      |
| Planned `legal/`                                               | License policy and obligations                                        | OSS / SETUP      |
| [dependencies.md](dependencies.md)                             | Dependency pins, decisions and licensing                              | SETUP            |
| Planned `pl/`                                                  | Polish translation sources                                            | OVE_OSS005       |
| Planned `user/`                                                | End-user guide after usable slices                                    | Later            |
| Planned `assets/`                                              | Public images without personal data                                   | DS / branding    |

## Conventions

Write new code and documentation in English. Capitalise glossary terms: Owner, Chief, Workspace, Run and Node. Use sentence-case headings, one H1 per file and Mermaid diagrams. Decisions belong in ADRs. Never include screenshots with personal data.

The specification distinguishes **CONFIRMED** Owner decisions, **PROPOSED** recommendations awaiting verification and **OPEN** questions. An **ASSUMPTION** is an explicit task default until the Owner answers; it cannot change scope or permissions.

Use relative links and real GitHub heading anchors. Future files need an owning task in the pending-link registry; publication is blocked while entries remain. Run `pnpm check:docs` offline. Flags for publication, translation parity, generated contents and public-link reachability are in the [checker guide](../tools/docs-check/README.md).

Folder owners append one descriptive row per document, alphabetically. Do not translate source documents as unrelated work.
