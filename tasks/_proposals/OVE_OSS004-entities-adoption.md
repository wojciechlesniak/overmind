# OVE_OSS004: reuse the existing entity decoder

Status: exact direct adoption approved by the integrator on 2026-10-17. No policy
exception, version update or transitive graph expansion is approved.

Standards review found valid numeric and named character references disappearing
from heading anchors. The same omission affects encoded link destinations before
path and URL validation. The official markdownlint public micromark tokens expose
the original references. Its optional markdown-it seam requires a separate parser
factory, which is not installed; no private module imports will be used.

Adopt exactly `entities` 7.0.1, already resolved in the approved lockfile, through
its public strict decoding API. Its actual license is BSD-2-Clause, already
allowed by the unchanged policy. It has no runtime dependencies and no consumer
install lifecycle script. Add only the catalog pin, root devDependency, generated
lockfile importer and dependency-register entry; preserve all existing versions,
release-age 4320, integrity, peer, license, audit and denied-script controls.

Value: decode individual recognized references as inert strings before applying
the existing heading/path/URL checks. It never renders HTML or runs JavaScript.
Maintenance: recheck upstream public API, license and semantic regression fixtures
when the exact pin changes. Source: the installed publisher's package metadata,
README and public type declarations for 7.0.1; upstream is
[fb55/entities](https://github.com/fb55/entities).

Alternatives considered: constructing an existing happy-dom environment is much
heavier and brings avoidable DOM/JavaScript/network lifecycle concerns; adding
markdown-it introduces another parser and graph; copying a table of thousands of
named references duplicates maintained data and provenance obligations. A partial
handwritten table would incorrectly claim full named-reference support.

Adoption remains subject to real frozen install, dependency, license, audit,
release-age and script gates plus both independent reviews of the final head.
