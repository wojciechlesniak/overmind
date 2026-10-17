# OVE_SETUP017 exact Node runtime notice review

Status: exact binary-only scope explicitly approved by the Owner on 2026-10-17.
The recorded ledger is `tools/package-engine/runtime-licenses.json`; npm and Rust
license policies remain unchanged.

## Identity and evidence

- Official Node 22.23.3 darwin-arm64 archive SHA-256:
  `23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53`.
- Official detached checksum signature verified against published release key
  `5BE8A3F6C8A5C01D106C0AD820B1A390B168D356` using an isolated GPG keyring.
- Exact unmodified archive `LICENSE`: 145485 bytes, SHA-256
  `c738ae413cf561f174e34f6961f8ca458aae2369a73640dda6234c629b98bcc4`.
- The packager extracts only `bin/node` and `LICENSE`. It does not distribute
  npm, Corepack, Node headers, build tools, test fixtures or ICU source scripts.
  The full notice file deliberately retains their publisher-supplied notices;
  the presence of a notice is not proof that its source code is in the binary.
- The current npm/Rust license gate does not inventory binary internals. Its pass
  must not be described as approval of all runtime subcomponents.

## Full top-level publisher notice inventory

The ranges below refer to the exact archive LICENSE above. IDs inferred by
matching the supplied text are inventory labels, not legal approval. Node's own
core notice at lines 1-52 is MIT. Every publisher top-level block is listed.

| Component | Publisher source path | LICENSE lines | Notice/identified terms |
| --- | --- | --- | --- |
| Acorn | `deps/acorn` | 54-78 | MIT |
| c-ares | `deps/cares` | 79-106 | MIT |
| cjs-module-lexer | `deps/cjs-module-lexer` | 107-120 | MIT |
| ittapi | `deps/v8/third_party/ittapi` | 121-132 | BSD-3-Clause |
| amaro | `deps/amaro` | 133-157 | MIT |
| swc | `deps/amaro/dist` | 158-362 | Apache-2.0 |
| ICU | `deps/icu-small` | 363-929 | Unicode-3.0 + ICU; nested notices below |
| libuv | `deps/uv` | 930-988 | MIT |
| llhttp | `deps/llhttp` | 989-1014 | MIT |
| corepack | `deps/corepack` | 1015-1025 | MIT |
| undici | `deps/undici` | 1026-1050 | MIT |
| postject | `test/fixtures/postject-copy` | 1051-1290 | MIT; embedded LIEF Apache-2.0 notice |
| OpenSSL | `deps/openssl` | 1291-1470 | Apache-2.0 |
| Punycode.js | `lib/punycode.js` | 1471-1494 | MIT |
| V8 | `deps/v8` | 1495-1559 | BSD-3-Clause; nested references below |
| SipHash | `deps/v8/src/third_party/siphash` | 1560-1570 | public-domain dedication (not relabeled Unlicense) |
| zlib | `deps/zlib` | 1571-1597 | Zlib |
| simdjson | `deps/simdjson` | 1598-1802 | Apache-2.0 |
| simdutf | `deps/simdutf` | 1803-1824 | MIT |
| ada | `deps/ada` | 1825-1846 | MIT |
| minimatch | `deps/minimatch` | 1847-1905 | BlueOak-1.0.0 |
| npm | `deps/npm` | 1906-2134 | Artistic-2.0 (npm application not extracted) |
| GYP | `tools/gyp` | 2135-2166 | BSD-3-Clause |
| inspector_protocol | `deps/inspector_protocol` | 2167-2197 | BSD-3-Clause |
| jinja2 | `tools/inspector_protocol/jinja2` | 2198-2232 | BSD-3-Clause |
| markupsafe | `tools/inspector_protocol/markupsafe` | 2233-2269 | BSD-3-Clause |
| cpplint.py | `tools/cpplint.py` | 2270-2300 | BSD-3-Clause |
| gypi_to_gn.py | `tools/gypi_to_gn.py` | 2301-2329 | BSD-3-Clause |
| gtest | `deps/googletest` | 2330-2361 | BSD-3-Clause |
| nghttp2 | `deps/nghttp2` | 2362-2388 | MIT |
| large_pages | `src/large_pages` | 2389-2411 | MIT |
| caja | `lib/internal/freeze_intrinsics.js` | 2412-2429 | Apache-2.0 |
| brotli | `deps/brotli` | 2430-2452 | MIT |
| zstd | `deps/zstd` | 2453-2486 | BSD-3-Clause alternative in supplied text |
| HdrHistogram | `deps/histogram` | 2487-2531 | BSD-2-Clause alternative (also CC0) |
| node-heapdump | `src/heap_utils.cc` | 2532-2568 | ISC |
| rimraf | `lib/internal/fs/rimraf.js` | 2569-2587 | ISC |
| uvwasi | `deps/uvwasi` | 2588-2612 | MIT |
| ngtcp2 | `deps/ngtcp2/ngtcp2/` | 2613-2638 | MIT |
| nghttp3 | `deps/ngtcp2/nghttp3/` | 2639-2664 | MIT |
| node-fs-extra | `lib/internal/fs/cp` | 2665-2683 | MIT |
| on-exit-leak-free | `lib/internal/process/finalization` | 2684-2708 | MIT |
| sonic-boom | `lib/internal/streams/fast-utf8-stream.js` | 2709-2732 | MIT |

## Nested notices and distribution boundary

ICU additionally retains Unicode-3.0, the historical ICU permission notice,
Chinese/Japanese dictionary notices (Google, libtabe/TaBE and Academia Sinica
BSD-3-Clause; Chih-Hao Tsai attribution; IPADIC/ICOT terms), Lao dictionary
BSD-2-Clause, Burmese dictionary BSD-3-Clause, public-domain TZDB,
double-conversion BSD-3-Clause and nlohmann/json MIT. Its build-only `aclocal.m4`
and `config.guess` carry GPL terms with an Autoconf exception, `install-sh` has
an MIT-style permission notice, and the ICU4J `sorttable.js` notice is MIT. None
of those source/build/JavaScript files is extracted or shipped by this packager.

V8 lists source/test references for PCRE regexp tests, WebKit layout tests,
Strongtalk assembler, Valgrind headers and Wasm C/C++ API headers. The supplied
notice identifies BSD terms for the layout/assembler/Valgrind references and
Apache terms for Wasm. Test source is not extracted or shipped. Postject's
publisher block includes LIEF Apache-2.0. The Node distribution also has built-in
SQLite, whose authors dedicate deliverable code to the public domain; this is
not an npm package nor automatically covered by the Rust exceptions.

## Exact Owner decision recorded on 2026-10-17

The Owner explicitly approved only the following runtime scope, tied to the exact
Node version, archive hash, notice hash and two extracted members above. This
separate binary-only ledger does not broaden the npm allowlist or reuse the 27
Rust exceptions:

- `Unicode-3.0`, historical `ICU`, `IPADIC` and `Zlib` for this runtime only.
- The exact public-domain dedications for SQLite, SipHash and TZDB; retain their
  provenance instead of pretending they are the different `Unlicense` text.
- Preserve the complete unmodified publisher LICENSE in every signed app at
  `Contents/Resources/engine/LICENSE`; verify its manifest hash after bundling.
- No approval of GPL/Artistic npm/build/test code is granted: it is not shipped
  by the exact extraction recipe. No native addon, arbitrary version or upgrade
  is included. Any changed runtime/archive/notice requires a fresh review.

The ledger now records `status: approved` and the dated explicit Owner decision.
A proposed entry or missing decision still blocks production. A changed runtime,
archive, notice, extraction recipe or term list requires a fresh review and Owner
decision. This is a project policy decision, not a claim that any license is
unsafe or incompatible.

## Primary sources

- [Official Node archive and signed checksum files](https://nodejs.org/dist/v22.23.3/).
- [Official Node release-key fingerprint](https://github.com/nodejs/release-keys).
- [Unicode-3.0 text](https://spdx.org/licenses/Unicode-3.0.html),
  [ICU text](https://spdx.org/licenses/ICU.html),
  [IPADIC text](https://spdx.org/licenses/IPADIC.html),
  [Zlib text](https://spdx.org/licenses/Zlib.html).
- [SQLite deliverable copyright statement](https://sqlite.org/copyright.html).
