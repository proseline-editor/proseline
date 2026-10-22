# Security policy

## Supported versions

Security fixes go into the latest released minor version of the `@proseline-editor/*` packages (they are versioned
together).

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub:
[Report a vulnerability](https://github.com/proseline-editor/proseline/security/advisories/new) (Security tab →
"Report a vulnerability"). Include the affected package and version, what an attacker can do, and steps to reproduce.

We aim to acknowledge reports within a week. A fix, a release and a published advisory follow, crediting you unless
you prefer otherwise.

Areas that deserve particular care: HTML, Markdown and DOCX import (content is parsed into the prose schema, which
drops scripts and unknown markup), exported links (only `http(s):`, `mailto:`, `#` and `/` targets are written), and
the sync server helpers in `@proseline-editor/sync/server`, which validate Yjs updates before applying them.
