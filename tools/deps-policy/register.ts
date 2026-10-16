export interface RegisterEntry {
  name: string;
  fields: Readonly<Record<string, string>>;
}
const required = [
  "Version",
  "License",
  "Used by",
  "Added by",
  "Value",
  "Maintenance cost",
  "Alternatives considered",
  "Risk",
  "Last reviewed",
];
function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function plain(value: string): string {
  return value.replaceAll("`", "").trim();
}
export function parseRegister(source: string) {
  const verified = /^Verified on:\s*(\d{4}-\d{2}-\d{2})\s*$/mu.exec(source)?.[1];
  if (!verified || !isDate(verified)) {
    throw new Error("Dependency verification date is missing or invalid");
  }
  const entries = new Map<string, RegisterEntry>();
  const sections = source.split(/^### /mu).slice(1);
  for (const section of sections) {
    const lines = section.split("\n");
    const name = plain(lines.shift() ?? "");
    if (!name || entries.has(name)) {
      throw new Error("Register headings must be nonempty and unique");
    }
    const fields: Record<string, string> = {};
    let active: string | undefined;
    for (const line of lines) {
      if (line.startsWith("## ")) {
        break;
      }
      const match = /^- ([A-Za-z][A-Za-z ]+):\s*(.*)$/u.exec(line);
      if (match?.[1]) {
        active = match[1];
        if (Object.hasOwn(fields, active)) {
          throw new Error(`Duplicate register field: ${name}`);
        }
        fields[active] = plain(match[2] ?? "");
      } else if (active && /^\s+\S/u.test(line)) {
        fields[active] = `${fields[active] ?? ""} ${plain(line)}`;
      }
    }
    if (required.some((key) => !fields[key])) {
      throw new Error(`Incomplete register block: ${name}`);
    }
    if (!/^OVE_[A-Z]{2,6}[0-9]{3}$/u.test(fields["Added by"] ?? "")) {
      throw new Error(`Invalid register task reference: ${name}`);
    }
    if (!isDate(fields["Last reviewed"] ?? "") || (fields["Last reviewed"] ?? "") > verified) {
      throw new Error(`Invalid register review date: ${name}`);
    }
    entries.set(name, { name, fields });
  }
  if (!entries.size) {
    throw new Error("Dependency register is empty");
  }
  const matrix = new Map<string, string>();
  const table = source.split("## Compatibility matrix\n")[1]?.split(/^## /mu)[0];
  if (!table) {
    throw new Error("Compatibility matrix is missing");
  }
  for (const line of table.split("\n")) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line.split("|").slice(1).map(plain);
    const name = cells[0];
    if (!name || name === "Package" || /^[-: ]+$/u.test(name)) {
      continue;
    }
    const version = cells[1];
    if (!version || matrix.has(name)) {
      throw new Error("Invalid or duplicate matrix row");
    }
    matrix.set(name, version);
  }
  return { entries, matrix, verified };
}
