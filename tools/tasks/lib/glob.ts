function prefix(pattern: string): string {
  const segments = pattern.split("/");
  const wildcard = segments.findIndex((segment) =>
    ["*", "?", "[", "{"].some((character) => segment.includes(character)),
  );
  return (wildcard < 0 ? segments : segments.slice(0, wildcard)).join("/");
}

export function ownsOverlap(a: readonly string[], b: readonly string[]): string[] {
  const overlaps = new Set<string>();
  for (const first of a.map(prefix)) {
    for (const second of b.map(prefix)) {
      if (!first || first === second || second.startsWith(`${first}/`)) {
        overlaps.add(second || ".");
      } else if (!second || first.startsWith(`${second}/`)) {
        overlaps.add(first);
      }
    }
  }
  return [...overlaps].sort();
}
