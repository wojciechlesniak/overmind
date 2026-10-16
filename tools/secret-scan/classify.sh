#!/bin/bash
set -euo pipefail
report="$1"
status="$2"
[[ -f "$report" && ! -L "$report" && "$(wc -c < "$report")" -le 67108864 ]]
[[ "$status" == 0 || "$status" == 1 ]] || { echo 'Secret scanner unavailable' >&2; exit 2; }
script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
warning="$(jq -er '.warningRule | select(type == "string" and length > 0)' "$script_root/policy.json")"
jq -e '.version == "2.1.0" and (.runs | type == "array" and length > 0) and all(.runs[]; (.results | type == "array") and all(.results[]; (.ruleId | type == "string" and length > 0)))' "$report" >/dev/null
findings="$(jq --arg warning "$warning" '[.runs[].results[] | select(.ruleId != $warning)] | length' "$report")"
warnings="$(jq --arg warning "$warning" '[.runs[].results[] | select(.ruleId == $warning)] | length' "$report")"
if [[ "$status" == 1 && "$findings" == 0 && "$warnings" == 0 ]]; then
  echo 'Scanner failed without finding evidence' >&2
  exit 2
fi
echo "Secret findings: $findings; Keychain warnings: $warnings"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "Credential findings: $findings; Keychain warnings: $warnings"
    printf '\n```text\n'
    jq -c '.runs[].results[] | [.ruleId, (.locations[0].physicalLocation.artifactLocation.uri // "unknown"), (.locations[0].physicalLocation.region.startLine // 0)]' "$report"
    printf '```\n'
  } >> "$GITHUB_STEP_SUMMARY"
fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "findings=$findings"
    echo "warnings=$warnings"
  } >> "$GITHUB_OUTPUT"
fi
[[ "$findings" == 0 ]]
