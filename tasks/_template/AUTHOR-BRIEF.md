# Brief for task authors (people or agents writing tasks)

You write Markdown task descriptions for Overmind. **Nothing is built in this phase.** Do not write source code, configuration or repository scaffolding. Illustrative signatures, zod field lists, SQL column lists and API payload examples inside a task are fine and encouraged. The output of your work is `tasks/<ID>/TASK.md` files (and `design.png` crops for UI tasks).

## Mandatory reading, in order

1. `tasks/CONVENTIONS.md` (authoritative: ID scheme, front matter, 14 body sections, size limits, parallel-work rules, architecture and security rules, Definition of Done).
2. `tasks/PLAN.md` (target layout, area codes, reserved foundation IDs, capability naming, ownership map).
3. `tasks/_template/TASK.md`.
4. Project docs through the Projects tool (`project_read`). These are authoritative and newer than the local copies in `/mnt/user-data/outputs/overmind/docs`: `docs/SPECIFICATION.md` (v1.4, read ALL of it), `claude/GLOSSARY.md`, `docs/design/styl-wizualny.md`, and every ADR relevant to your area (`docs/adr/0001`..`0028`; ADR 0001 is superseded by 0023). Read `docs/research/herdr-analiza.md` and `docs/research/prototyp-wnioski.md` when your area touches providers, terminals or isolation (they contain verified facts from a prototype, for example that agent work directories must always be `/work`, that herdr agent state is only a hint, and that CLI logins live in a separate persistent volume).
5. UI-related areas: `tasks/_design/VIEWS.md` and `tasks/_design/COMPONENT-INVENTORY.md`, then look at the PNGs in `tasks/_design/views/` and the HTML in `tasks/_design/source/` for the views you cover.

## What the Owner asked for (do not lose this)

- Tasks must be **very well described**. A long, complete description is better than a short one that causes a hundred follow-up tasks. Think about everything the implementer needs: data shapes, API paths, state machines, limits, defaults, error cases, copy strings, accessibility, security, tests.
- Tasks are **small**, so agents never work for many hours on one large view. Split views by layer and by region.
- **Reusable components first.** UI tasks must reuse `ui-kit` components (referenced by capability `ui:<Name>` in `needs`) and must not re-implement buttons, pills, cards and similar. Before inventing something, check `COMPONENT-INVENTORY.md` for the existing component and variant. If you notice a missing variant, say so in the task and add it to the Open questions section; do not create it inside a feature task.
- **SOLID, DRY, KISS, Clean Architecture** (rules in CONVENTIONS section 6). Code must be easy for newcomers to extend.
- **Security is part of every task** (CONVENTIONS section 7). Think about the abuse cases of your feature: what if the agent is malicious, the input is prompt injection, the path is a symlink, the Telegram message is forged, the process crashes halfway, the action is retried.
- **Many agents work at the same time.** Each task states `owns` paths that do not overlap with other tasks, uses the extension points of CONVENTIONS section 5, and lists real dependencies.
- If a task has a visual specification, it has a `design.png` next to `TASK.md`. If the task is about functionality only, there is no image and the front matter says `design: none`.

## Cross-area references

- Foundation IDs listed in `PLAN.md` section 3 are fixed. Reference them directly in `depends_on` when they are real prerequisites.
- For everything owned by other areas written in parallel (you cannot know their IDs), use capability names: put what you create in `provides` and what you consume in `needs` (naming in PLAN section 4). A later linker pass converts them into `depends_on`. Inside your own area use real IDs in `depends_on`.
- Never leave a consumed capability unnamed. If you need something no area obviously provides, name it anyway and mention it in your final report so the linker can create an owner.

## Creating `design.png` (UI tasks only)

Use `python3 /tmp/claude-0/-home-claude/5902708d-a030-5d61-b5a5-694a5895c285/scratchpad/crop.py <View> <x> <y> <w> <h> tasks/<ID>/design.png` with the region boxes (CSS px, 1440x900 viewport) from `_design/VIEWS.md`. The view names are the file stems in `_design/views/` (Main, Chief, Czat-Agent, Tablica, ...). Open every crop with the Read tool and check that it shows exactly the part the task implements, with a few px of margin and nothing from unrelated regions. Record the view, region slug and box in `design_source`. Add `design-<name>.png` for extra crops (a state, a zoomed detail) when useful. A task implements a region, not necessarily a whole view; one view is spread over several tasks.

## Self-check before you finish

Run `python3 /tmp/claude-0/-home-claude/5902708d-a030-5d61-b5a5-694a5895c285/scratchpad/validate.py <YOUR_AREAS...>` and fix every ERROR (warnings about unknown dependencies on other areas are expected). Re-read three of your tasks as if you were the implementer with no other context: could you start immediately? Are acceptance criteria testable? Are security and edge cases concrete?

## Your final reply

Reply with a compact report: per area the number of tasks, a table `ID | title | size | provides | needs`, and a list of gaps or cross-area questions (capabilities you need that nobody obviously provides, assumptions that need the Owner's answer). Keep it under ~150 lines. Do not paste task contents.
