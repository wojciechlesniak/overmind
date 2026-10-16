# Third-party Rust notices

These exact library versions are approved by the Owner on 2026-10-16.
The application remains Apache-2.0; third-party files retain their own terms.

| Package                   | License expression                  | License texts                                                                                                                                                                              |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cssparser 0.37.0          | MPL-2.0                             | [LICENSE](licenses/cssparser-0.37.0/LICENSE)                                                                                                                                               |
| cssparser-macros 0.7.1    | MPL-2.0                             | [LICENSE](licenses/cssparser-macros-0.7.1/LICENSE)                                                                                                                                         |
| dtoa-short 0.3.5          | MPL-2.0                             | [LICENSE](licenses/dtoa-short-0.3.5/LICENSE)                                                                                                                                               |
| foldhash 0.2.0            | Zlib                                | [LICENSE](licenses/foldhash-0.2.0/LICENSE)                                                                                                                                                 |
| icu_collections 2.3.0     | Unicode-3.0                         | [LICENSE](licenses/icu_collections-2.3.0/LICENSE)                                                                                                                                          |
| icu_locale_core 2.3.0     | Unicode-3.0                         | [LICENSE](licenses/icu_locale_core-2.3.0/LICENSE)                                                                                                                                          |
| icu_normalizer 2.3.0      | Unicode-3.0                         | [LICENSE](licenses/icu_normalizer-2.3.0/LICENSE)                                                                                                                                           |
| icu_normalizer_data 2.3.0 | Unicode-3.0                         | [LICENSE](licenses/icu_normalizer_data-2.3.0/LICENSE)                                                                                                                                      |
| icu_properties 2.3.0      | Unicode-3.0                         | [LICENSE](licenses/icu_properties-2.3.0/LICENSE)                                                                                                                                           |
| icu_properties_data 2.3.0 | Unicode-3.0                         | [LICENSE](licenses/icu_properties_data-2.3.0/LICENSE)                                                                                                                                      |
| icu_provider 2.3.1        | Unicode-3.0                         | [LICENSE](licenses/icu_provider-2.3.1/LICENSE)                                                                                                                                             |
| litemap 0.8.3             | Unicode-3.0                         | [LICENSE](licenses/litemap-0.8.3/LICENSE)                                                                                                                                                  |
| option-ext 0.2.0          | MPL-2.0                             | [LICENSE.txt](licenses/option-ext-0.2.0/LICENSE.txt)                                                                                                                                       |
| potential_utf 0.1.6       | Unicode-3.0                         | [LICENSE](licenses/potential_utf-0.1.6/LICENSE)                                                                                                                                            |
| selectors 0.38.0          | MPL-2.0                             | [LICENSE-MPL-2.0.txt](licenses/selectors-0.38.0/LICENSE-MPL-2.0.txt)                                                                                                                       |
| target-lexicon 0.12.16    | Apache-2.0 WITH LLVM-exception      | [LICENSE](licenses/target-lexicon-0.12.16/LICENSE)                                                                                                                                         |
| tinystr 0.8.4             | Unicode-3.0                         | [LICENSE](licenses/tinystr-0.8.4/LICENSE)                                                                                                                                                  |
| unicode-ident 1.0.27      | (MIT OR Apache-2.0) AND Unicode-3.0 | [LICENSE-APACHE](licenses/unicode-ident-1.0.27/LICENSE-APACHE), [LICENSE-MIT](licenses/unicode-ident-1.0.27/LICENSE-MIT), [LICENSE-UNICODE](licenses/unicode-ident-1.0.27/LICENSE-UNICODE) |
| writeable 0.6.4           | Unicode-3.0                         | [LICENSE](licenses/writeable-0.6.4/LICENSE)                                                                                                                                                |
| yoke 0.8.3                | Unicode-3.0                         | [LICENSE](licenses/yoke-0.8.3/LICENSE)                                                                                                                                                     |
| yoke-derive 0.8.4         | Unicode-3.0                         | [LICENSE](licenses/yoke-derive-0.8.4/LICENSE)                                                                                                                                              |
| zerofrom 0.1.8            | Unicode-3.0                         | [LICENSE](licenses/zerofrom-0.1.8/LICENSE)                                                                                                                                                 |
| zerofrom-derive 0.1.8     | Unicode-3.0                         | [LICENSE](licenses/zerofrom-derive-0.1.8/LICENSE)                                                                                                                                          |
| zerotrie 0.2.5            | Unicode-3.0                         | [LICENSE](licenses/zerotrie-0.2.5/LICENSE)                                                                                                                                                 |
| zerovec 0.11.8            | Unicode-3.0                         | [LICENSE](licenses/zerovec-0.11.8/LICENSE)                                                                                                                                                 |
| zerovec-derive 0.11.6     | Unicode-3.0                         | [LICENSE](licenses/zerovec-derive-0.11.6/LICENSE)                                                                                                                                          |
| zlib-rs 0.6.8             | Zlib                                | [LICENSE](licenses/zlib-rs-0.6.8/LICENSE)                                                                                                                                                  |

## MPL source availability

The sources of the five MPL-2.0 libraries are supplied unchanged in `sources/`,
as complete upstream `.crate` archives. Their SHA-256 hashes equal Cargo.lock.
Each archive contains the source files and license notices received from its author.
The selectors crate carries MPL headers without a separate LICENSE file; its notice directory additionally supplies the standard MPL-2.0 text.
Recipients can decompress the gzip/tar archive with standard archive tools.
MPL source files, including any future modifications, remain subject to MPL-2.0.
The source archives and these notices are bundled under `Contents/Resources/licenses/rust/`.
The release must preserve them when packaging the application; no substitute binary-only notice is sufficient.

For future changes: update the source archive and notices to match any approved
modified MPL source, record the change, and obtain review before distribution.
License approval does not approve vulnerabilities, untrusted sources or another version.
