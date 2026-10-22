# Publishing Proseline: GitHub and npm setup

A one-time setup for the repository owner, then the routine for every release. Everything else is already in place
in the repository: CI, Release and Docs workflows, changesets, npm provenance and the community files.

## 1. Decide where it lives

The repository files assume the GitHub organization **`proseline-editor`** and the repository **`proseline`**, and
the npm organization **`proseline-editor`**, which gives the `@proseline-editor/*` scope.

If you choose another owner or name, replace `github.com/proseline-editor/proseline` everywhere before the first
release. npm provenance checks that `repository.url` matches the repository that runs the workflow.

```bash
grep -rl "github.com/proseline-editor" --exclude-dir=node_modules --exclude-dir=dist .
```

The places to change are `packages/*/package.json` (`repository`, `homepage`, `bugs`), `packages/*/README.md`,
`SECURITY.md`, `CODE_OF_CONDUCT.md` and `.github/ISSUE_TEMPLATE/config.yml`.

## 2. GitHub

1. **Create the organization** at <https://github.com/organizations/plan> (Free plan): name `proseline-editor`. In
   its profile, add a contact email; `CODE_OF_CONDUCT.md` points reporters there.
2. **Create the repository** `proseline-editor/proseline`, public, *without* a README, licence or .gitignore (they
   exist already). Push:

   ```bash
   git remote add origin git@github.com:proseline-editor/proseline.git
   git push -u origin main
   ```

3. **Settings → Actions → General:**
   - "Workflow permissions": *Read and write permissions*.
   - Tick *Allow GitHub Actions to create and approve pull requests*, so changesets can open the "Version packages"
     PR.
4. **Settings → Rules → Rulesets → New branch ruleset** for `main`:
   - Require a pull request before merging.
   - Require status checks to pass, and add `check` and `node20` (they appear after the first CI run).
   - Block force pushes.
5. **Settings → Code security:**
   - Enable *Private vulnerability reporting*; `SECURITY.md` links to it.
   - Enable *Dependabot alerts*.
6. Optional: **Settings → General → Features → Discussions**, for questions that aren't bugs.

The first push runs CI (`check`: build, API reports, lint, typecheck, unit tests, size budgets and the e2e suites;
`node20`: the server-side example on Node 20). The Release workflow also runs. Without changesets on `main` it does
nothing; with them it opens a PR.

## 3. npm

1. Sign in to <https://www.npmjs.com> and turn on **two-factor authentication** (*Account → Two-Factor
   Authentication*).
2. **Create the organization** `proseline-editor` (*Add organization*, the free plan for public packages). This
   reserves the `@proseline-editor` scope.
3. **Create a token for the first release.** Go to *Access Tokens → Generate New Token → Granular Access Token*:
   - Name: `proseline-release`.
   - Expiration: 30 days.
   - *Packages and scopes*: Read and write, scope `@proseline-editor`.
   - *Organizations*: none.
   - Allow it to bypass 2FA for automation.
4. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name `NPM_TOKEN`, value: the
   token. The Release workflow passes it to `changeset publish` and sets `NPM_CONFIG_PROVENANCE=true`, so every
   package gets a signed provenance statement linking it to the commit and workflow run.

**Later, drop the token (recommended).** Once the eight packages exist on npm, switch each to *Trusted publishing*:
*package → Settings → Trusted publishers → GitHub Actions*, organization `proseline-editor`, repository `proseline`,
workflow `release.yml`. Then delete the `NPM_TOKEN` secret.

Trusted publishing requires a recent npm CLI in the workflow. Check npm's documentation at that time for the minimum
version, and whether `changeset publish` uses it in a pnpm workspace. Update `.github/workflows/release.yml` to
match, for example with a `npm install -g npm@latest` step.

## 4. The documentation site (GitHub Pages)

The `Docs` workflow builds the site (`pnpm docs:build`) and runs its smoke tests on every push and pull request. It
publishes only after you switch it on:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**: `DEPLOY_DOCS` = `true`.
3. Push to `main`, or re-run the latest Docs workflow. The site appears at
   `https://proseline-editor.github.io/proseline/`; the deploy job links to it.

The workflow sets `DOCS_BASE=/<repository>/`, so a renamed repository needs no change. For a custom domain, set it in
**Settings → Pages**, add a `site/public/CNAME` file with the domain, and change `DOCS_BASE` to `/` in
`.github/workflows/docs.yml`.

Locally: `pnpm docs:dev` (http://localhost:4183) or `pnpm docs:build && pnpm --filter docs-site preview`.

## 5. Releasing

Every PR that changes a published package carries a changeset (`pnpm changeset`). All `@proseline-editor/*`
packages are versioned together (the `fixed` group in `.changeset/config.json`).

1. Merging to `main` with pending changesets makes the Release workflow open or update a **"Version packages"** PR.
   It bumps versions and writes each package's `CHANGELOG.md`.
2. Review that PR. Check that the version is right, and that the changelog reads well for users.
3. Merge it. The workflow builds and publishes every changed package to npm with provenance, and pushes git tags.
4. Check <https://www.npmjs.com/org/proseline-editor>: the new versions show a *Provenance* badge.

The packages are `0.0.0` today, and the pending changesets are all minor, so the first release is **0.1.0**. Before
1.0, breaking changes are released as minor versions and say so in their changeset. From 1.0 on they need a major
version, and the `api/*.api.md` reports make every public API change visible in review.

If a publish fails halfway (e.g. an expired token), fix the cause and re-run the failed Release job:
`changeset publish` skips versions that already exist on npm.
