interface ParsedCommit {
  raw: string;
  header?: string;
  subject?: string;
  type?: string;
  scope?: string;
}
type RuleResult = [boolean, string?];
export function areaScopes(): string[];
export function currentBranch(): string;
export function taskReference(parsed: ParsedCommit, when: string, branch: string): RuleResult;
export function commitPolicy(parsed: ParsedCommit): RuleResult;
declare const plugin: {
  rules: { "task-reference": typeof taskReference; "commit-policy": typeof commitPolicy };
};
export default plugin;
