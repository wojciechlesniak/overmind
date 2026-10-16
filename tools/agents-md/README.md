# Agent instruction checker

`pnpm check:agents-md` checks the root instructions without executing any command
found in them. It verifies ordered sections, the 200-line bound, local link
containment and existence, root script names, the exact injection paragraph hash,
the maintenance sentence and a relative CLAUDE.md symlink. It rejects AGENTS.md
symlinks, unreadable files, malformed manifests, reference-style links and common
credential or private-contact patterns. Diagnostics never include matching text.

Use standard inline Markdown links without titles. Soft-wrapped paragraphs are
joined with spaces before the exact hash comparison, preserving Prettier wrapping.
Required headings and paragraphs must be visible prose. Fenced examples support
backticks and tildes, at least three delimiter characters, zero to three leading
spaces and matching closing runs at least as long as the opening. A shorter run,
another marker or trailing non-whitespace cannot close a fence; an unclosed fence
hides content through EOF. Fences are processed before comments so a comment
cannot manufacture a closing delimiter. Indented blocks and raw HTML blocks are
unsupported in this instruction document and fail closed rather than guessing
whether their text is visible. Raw HTML is forbidden anywhere outside code, even
after ordinary text; details/hidden tags cannot hide mandatory rules. Literal
HTML-like text such as `<ID>` belongs in a code span or fenced example. Supported
code spans use equal-length backtick runs on one line, with no backslash directly
before the opening run. Mismatched, escaped or unclosed runs cannot exempt HTML
from the guard. Use flat lists and fenced examples instead.
Leading TAB characters outside fenced code are rejected even after spaces, so
tab-stop expansion cannot hide required prose as an indented code block. Only LF
and CRLF line endings are supported; bare CR is rejected before the visibility
and line-count results can be accepted.
File links are canonicalised and cannot escape the repository through traversal,
percent encoding or symlinks. The small credential screen supplements the full
pinned secret scanner in hooks and CI; it does not replace that scanner.

The checker verifies that named scripts exist, not that their future implementation
is already merged. AGENTS.md states the current foundation-tool limitations. The
owning task must update those statements when its tool becomes available.

Tests use independent temporary directories and actual filesystem symlinks. A
Git fixture verifies that the symlink is staged as mode 120000. No product runtime,
personal Skills, provider configuration or additional dependency is introduced.
