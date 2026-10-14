# Overmind

Overmind is an open-source macOS app for one Owner: a **Chief** you talk to, a team of **Agents** that work through the official `claude` and `codex` CLIs, a visual workflow builder, a task board, a decision register and a Telegram channel. Agents run in OS-level isolation, with permissions that are denied by default.

> **Status: planning phase.** This repository currently holds the specification, the architecture decisions and a complete, dependency-ordered backlog of implementation tasks. There is no application code yet.

## What is here

- [`tasks/`](tasks/) – the backlog: 927 small, self-contained task descriptions (`OVE_<AREA><NNN>/TASK.md`), with design images, explicit dependencies and acceptance criteria. Start with [`tasks/README.md`](tasks/README.md) and [`tasks/CONVENTIONS.md`](tasks/CONVENTIONS.md).
- [`docs/`](docs/) – specification, ADRs, glossary, design notes and research.
- Every task is also tracked as a GitHub issue titled `OVE-nnn`, in build order.

## License

[Apache-2.0](LICENSE), the same license as [herdr](https://github.com/herdrdev/herdr), which Overmind builds on for its terminal layer.

## Contributing

Contribution model: issues are open, pull requests are accepted after the issue is accepted, and a list of trusted contributors can open pull requests directly. Details will live in `CONTRIBUTING.md` (task OVE-023).
