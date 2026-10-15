# ESLint extensions

To add rules, add `eslint.config.d/<area>.mjs`; never edit another task's module.
Each module default-exports an array of flat configurations. Modules load in
sorted order, so use a numeric prefix only when order matters. A broken import,
an invalid module export or a symlink outside the repository fails the command.
Environment variables cannot select additional config files.

`eslint-config-prettier` is always applied last. It disables formatting rules;
Prettier handles formatting independently. The final object retains the required
`curly: all` rule, which is compatible with Prettier but disabled by its
generic preset. TypeScript configuration is resolved
from the repository root, rather than the config-module directory. Tests retain
the deliberate non-null-assertion relaxation; explicit `any` remains forbidden.
Only fixture directories relax the unsafe-value rules.

`pnpm lint` also checks that suppression comments contain `-- reason`. Prefer a
code correction to suppression. `.only` is always forbidden. A `.skip` needs a
line comment `// skip: OVE_XXX000` immediately above the call.

Future architecture and i18n tasks supply their own modules. No import boundary,
i18n or license-header rule is implemented here.

The existing 8.71.1 typescript-eslint pin follows the Owner's decision to update
later. Prettier and ESLint plugins consume the reviewed catalog pins. `yaml`
(ISC) and `zod` (MIT) validate test configuration at one shared parse boundary,
avoiding hand-written YAML parsing and unchecked JSON. They are development-only
here; the complete dependency register belongs to OVE-008. GLOSSARY.md and the
existing docs/tasks are excluded from formatting because their documentation
owners handle them; application and tooling source is fully checked.
