import { headings } from "./markdown.ts";

function replaceBlock(source: string, name: string, body: string): string {
  const start = `<!-- docs-${name}:start -->`;
  const end = `<!-- docs-${name}:end -->`;
  const starts = source.split(start).length - 1;
  const ends = source.split(end).length - 1;
  if (!starts && !ends) {
    return source;
  }
  if (starts !== 1 || ends !== 1 || source.indexOf(start) > source.indexOf(end)) {
    throw new Error("Malformed managed documentation block.");
  }
  return (
    source.slice(0, source.indexOf(start) + start.length) +
    `\n\n${body}\n\n` +
    source.slice(source.indexOf(end))
  );
}

export function updateGenerated(source: string, dependencies: string): string {
  if (!/<!-- docs-(?:toc|credits):(?:start|end) -->/u.test(source)) {
    return source;
  }
  const toc = headings(source)
    .filter((heading) => heading.level > 1 && heading.level < 4)
    .map(
      (heading) =>
        `${"  ".repeat(heading.level - 2)}- [${heading.text.replaceAll("[", "").replaceAll("]", "")}](#${heading.anchor})`,
    )
    .join("\n");
  const names = headings(dependencies)
    .filter((heading) => heading.level === 3)
    .map((heading) => `\`${heading.text.replace(/`/gu, "")}\``);
  const rows: string[] = [];
  for (let index = 0; index < names.length; index += 6) {
    rows.push(`- ${names.slice(index, index + 6).join(", ")}`);
  }
  const credits = `Inventory entries, including reserved tooling:\n\n${rows.join("\n")}`;
  return replaceBlock(replaceBlock(source, "toc", toc), "credits", credits);
}
