# Contributing to Proseline

Thank you for helping. Bug reports, fixes, features, translations and docs are all welcome.

## Before you start

- **Bugs:** open an issue with a minimal reproduction (the bug report template asks for one). For security problems, follow [SECURITY.md](SECURITY.md) instead.
- **Features and API changes:** open an issue first, so we can agree on the shape before you write code. The public API is listed in [`api/`](api); anything not there is internal and may change.
- **Translations:** UI strings live next to each feature (`messages` in `packages/core/src/features/*/index.ts`) and in `packages/core/src/locales.ts`. English, Ukrainian and French ship today.

## Setup

Node 22.12+ (see `.nvmrc`) and pnpm 10.

```bash
pnpm install
pnpm build          # packages → dist (tests use the sources, typecheck and examples use dist)
pnpm test           # unit tests (Vitest, happy-dom)
pnpm lint && pnpm typecheck
pnpm api:check      # the public API matches api/*.api.md
pnpm size           # bundle-size budgets
pnpm e2e            # Playwright: react-basic, vue-basic (one shared suite, in Chromium, Firefox and WebKit), react-collab,
                    # custom-transport, nextjs, electron
```

Docs: `pnpm docs:dev` serves the site (guides in `site/guide/`, the API reference generated from TSDoc comments, so
document new exports). Code shown in the guides lives in `site/snippets/` and is type-checked and tested.

Playgrounds: `pnpm --filter react-basic dev`, `pnpm --filter vue-basic dev`, and for collaboration
`pnpm --filter react-collab sync-server` plus `pnpm --filter react-collab dev` in two windows.

## How we write code

- **TypeScript, strict.** No `any`: use `unknown` and narrow.
- **Arrow functions only** (`const f = () => …`); ESLint enforces it. Object and class methods keep method syntax.
- **Tests next to the code** (`foo.ts` → `foo.test.ts`). Write the failing test first, then the code.
- **Adapters hold markup only.** Feature logic lives in core controllers, so React and Vue stay in step. A UI change goes into both adapters, and `examples/shared/e2e` must pass against both examples.
- **Comments in English.** Explain why, not what.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) style: `feat(core): …`, `fix(sync): …`, `docs: …`, `test: …`.

## Pull requests

1. Branch from `main`, keep the PR focused.
2. Add tests. Behaviour that needs a browser (selection, IME, paste) belongs in `examples/shared/e2e`. Paste cases use
   real clipboard HTML in `packages/core/test/paste/` (shared with the unit tests); add one when you fix a paste bug.
   The first run needs the browsers: `pnpm --filter react-basic exec playwright install chromium firefox webkit`.
3. If a published package changes, add a changeset: `pnpm changeset` (patch for fixes, minor for features; before 1.0 breaking changes are minor too).
4. If the public API changes, run `pnpm api:update` and commit the `api/*.api.md` diff. Reviewers read it.
5. Make sure `pnpm build && pnpm lint && pnpm typecheck && pnpm api:check && pnpm test && pnpm size && pnpm e2e` passes. CI runs the same.

On a busy machine the two 150k-word performance tests can miss their budgets. Re-run them on an idle machine, or relax
the thresholds locally with `PL_PERF_READY_MS`, `PL_PERF_KEY_MS` and `PL_PERF_STYLE_MS`. Never edit them to pass.

## Code of conduct

Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md).
