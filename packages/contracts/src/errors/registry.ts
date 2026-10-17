import { registrationInvariant, type ErrorCatalogue, type ErrorDefinition } from "./definition.ts";

export type ErrorRegistry = Readonly<Record<string, ErrorDefinition>>;
export interface CatalogueModule {
  readonly source: string;
  readonly errors: ErrorCatalogue;
}
type CatalogueCodes<Module> = Module extends CatalogueModule
  ? Module["errors"][keyof Module["errors"]]["code"]
  : never;
export type { ErrorDefinition, ErrorCatalogue } from "./definition.ts";

export function createErrorRegistry<const Modules extends readonly CatalogueModule[]>(
  modules: Modules,
): Readonly<Record<CatalogueCodes<Modules[number]>, ErrorDefinition>> {
  const registry: Record<string, ErrorDefinition> = {};
  const sources = new Map<string, string>();
  const areas = new Map<string, string>();
  for (const module of modules) {
    const moduleAreas = new Set(
      Object.values(module.errors).map((factory) => factory.code.split(".")[0] ?? ""),
    );
    for (const area of moduleAreas) {
      const previous = areas.get(area);
      if (previous) {
        registrationInvariant(`Duplicate error area in ${previous} and ${module.source}.`);
      }
      areas.set(area, module.source);
    }
    for (const factory of Object.values(module.errors)) {
      const previous = sources.get(factory.code);
      if (previous) {
        registrationInvariant(`Duplicate error code in ${previous} and ${module.source}.`);
      }
      sources.set(factory.code, module.source);
      registry[factory.code] = factory.definition;
    }
  }
  return Object.freeze(registry);
}

export function lookupError(registry: ErrorRegistry, code: string): ErrorDefinition | undefined {
  return Object.hasOwn(registry, code) ? registry[code] : undefined;
}
