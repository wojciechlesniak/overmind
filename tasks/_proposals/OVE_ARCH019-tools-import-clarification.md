# Clarify the existing Tools import limit

CONVENTIONS §6 says “Nothing imports from apps/*”. ARCHITECTURE §4 limits
`toolsMayImportAny` to catalogued library columns. Parent ARCH002's older
“tools anything” wording must be read within those limits.

The integrator confirmed this interpretation on 2026-10-19. Keep the existing
018 matrix implementation and prove Tools-to-app rejection in019. No permission,
canonical catalogue or shared helper change is proposed. Request the integrator
clarify only the ambiguous parent wording when maintaining its acceptance record.

Future023 must call ESLint with `allowInlineConfig: false`;019 proves that actual
public caller option with blanket and self-disabling comments. RuleTester also
checks each rule's own diagnostic IDs and positions. No current config is activated.
