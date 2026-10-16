#!/bin/bash
set -euo pipefail
scanner="$1"
source_root="$2"
report="$3"
mode="$4"
base="${5:-}"
head="${6:-}"
config="$7"
script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ "$scanner" == /* && "$source_root" == /* && "$report" == /* && "$config" == /* ]]
args=(git)
case "$mode" in
  range)
    [[ "$base" =~ ^[a-f0-9]{40}$ && "$head" =~ ^[a-f0-9]{40}$ ]]
    args+=("--log-opts=$base..$head")
    ;;
  all) args+=(--log-opts=--all) ;;
  staged) args+=(--staged) ;;
  tree)
    args=(dir --follow-symlinks=false)
    snapshot="$(mktemp -d "${TMPDIR:-/tmp}/overmind-secret-tree.XXXXXX")"
    trap 'rm -rf -- "$snapshot"' EXIT
    mkdir -- "$snapshot/source"
    git -C "$source_root" ls-files --cached --others --exclude-standard -z > "$snapshot/files"
    while IFS= read -r -d '' path; do
      [[ "$path" != /* && "/$path/" != *'/../'* && "/$path/" != *'/./'* ]] || exit 2
      current="$source_root"
      remaining="$path"
      linked=false
      while :; do
        component="${remaining%%/*}"
        current="$current/$component"
        if [[ -L "$current" ]]; then linked=true; break; fi
        [[ "$remaining" == */* ]] || break
        remaining="${remaining#*/}"
      done
      if [[ "$linked" == false && -f "$current" ]]; then
        mkdir -p -- "$(dirname -- "$snapshot/source/$path")"
        cp -- "$current" "$snapshot/source/$path"
      fi
    done < "$snapshot/files"
    cd -- "$snapshot/source"
    source_root=.
    ;;

  *) echo 'Unsupported secret scan mode' >&2; exit 2 ;;
esac
rm -f -- "$report"
"$scanner" "${args[@]}" --redact=100 --no-banner --ignore-gitleaks-allow \
  --gitleaks-ignore-path /dev/null --config "$config" \
  --report-format template --report-template "$script_root/safe-sarif.tmpl" --report-path "$report" "$source_root"
