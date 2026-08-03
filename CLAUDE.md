# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`@metricinsights/cs-helper` is a build/scaffolding toolkit for **Metric Insights Custom Scripts**. It is not itself a custom script — it's the npm package that other repos install to build and scaffold their custom scripts. There are two independent audiences to keep straight:

- **This repo's own code** (`src/`, `bin/`, `scripts/`, `test/`) — the library and CLI implementation, built/tested with the commands below.
- **Generated consumer projects** (`templates/`, `ai-addons/`) — files copied into a *new* custom-script project by `cs-helper-create`. `ai-addons/claude/CLAUDE.md` is a template for those generated projects (uses `%PLACEHOLDER%` tokens), not guidance for working in this repo.

## Commands

```shell
npm run build          # clean:dist + build:sources (tsc, src/ -> dist/) + build:bin (tsc --project tsconfig.bin.json, bin/ -> dist/bin/)
npm run build:sources  # compile src/ only
npm run build:bin      # compile bin/ only, then chmod the CLI entry points
npm run clean:dist     # remove dist/
npm test               # playwright test (runs test/*.spec.mjs)
npm run test:headed    # same, headed
npm run test:ui        # Playwright UI mode
```

- Tests import compiled output from `dist/bin/*.js`, not the TypeScript sources — **run `npm run build` (or at least `npm run build:bin`) before `npm test`** after touching anything under `bin/`.
- Run a single test file: `npx playwright test test/params-docs.spec.mjs`. Filter by title: `npx playwright test -g "password JSDoc"`.
- `test/scaffold.spec.mjs` is an integration test that scaffolds a real project via `cs-helper-create` and installs `@metricinsights/cs-helper` from the local tarball — it requires `npm run postbuild` (which runs automatically after `npm run build` via the `postbuild` script, producing `metricinsights-cs-helper-latest.tgz` at repo root) to have been run first.
- `postinstall`/`prepare` run `scripts/sync-npm-bundled-patches.js`, which patches vulnerable packages bundled *inside* npm's own `node_modules/npm` (brace-expansion, picomatch, ip-address, tar, sigstore, etc.) so `npm audit` stays clean; it's best-effort and silently no-ops if npm's internal layout changes.

## Architecture

### Runtime library (`src/`) — what ships to consumers via `import ... from '@metricinsights/cs-helper'`

- `src/index.ts` — the public API: `cs` (typed alias for the host-injected `customScript` global) and `parseParams<T>()`, which merges caller-supplied defaults with `cs.parameters` (runtime values win) and stores the result on `cs.parsedParams` / `globalThis.parsedParams`.
- `src/utils/` — secondary entry point (`@metricinsights/cs-helper/utils`): `log.ts` (leveled logging over `cs.log`), `data-convertor.ts` (dataset/metadata transform helpers).
- `src/polyfill/` — `index.ts` imports `./index-TARGET_EXTENSION`, a literal specifier that only resolves after the webpack build step (see below) rewrites it to `index-v6` or `index-v7`. Don't "fix" this import — it's intentionally unresolvable pre-build.
- Compiled independently from `bin/` via `tsconfig.json` (target `es2015`, excludes `bin/`) vs `tsconfig.bin.json` (target `esnext`/commonjs, excludes `src/`) — the library ships as ES2015 modules for consumer bundlers; the CLI runs directly under Node.

### Build CLI (`bin/build.ts`, invoked in consumer projects as `cs-helper <entry>`)

Bundles a consumer's custom-script entry file with webpack, resolving webpack/babel from **cs-helper's own** `node_modules` (not the consumer's) via `require.resolve(..., { paths: [packageRoot] })`. Key behaviors:

- **v6 vs v7 target** (`--v7` flag): controls the Babel `preset-env` target (`ie 11` vs `chrome 97` + core-js), webpack `target` (`es5` vs `es2023`), and rewrites the `polyfill/index-TARGET_EXTENSION` import to `-v6` or `-v7` via `NormalModuleReplacementPlugin`. v6 runs under PhantomJS in Metric Insights; v7 under Puppeteer/Chromium.
- **Banner metadata**: a `webpack.BannerPlugin` injects package info, a source hash (SHA-256 of the entry file + all relative imports it resolves, via `bin/params-docs.ts`'s `getSourceFilesFromEntry`), a params table/description, and a `Params Base64` block (from `bin/params-base64.ts`), plus the consumer's README content.
- **Checksum**: after compile, the banner's `Checksum:` placeholder (`0000000000000000`) is replaced with a SHA-256 hash of the final file content (tabs→2 spaces, CRLF→LF normalized first). See `README.md`'s "Verifying the Checksum" section for the exact algorithm — replicate it precisely if you touch this logic, since consumers verify against it externally.

### `bin/params-docs.ts` — static analysis of `parseParams<T>()` call sites

Uses the TypeScript compiler API to find every `parseParams` call in a consumer's entry file (and its transitive relative imports), extract the generic type argument (or infer from the default-params object literal), and produce a `typeInfoTable` (name/type/optional/description/example/accepted-values per field) plus a markdown params table for the build banner. `bin/params-type-display.ts` renders TS types to display strings (handles the "optional number shouldn't widen to `number | string`" case and `@password` JSDoc → `password` type mapping — both are regression-tested in `test/params-docs.spec.mjs`). `bin/params-base64.ts` consumes `typeInfoTable` to build the banner's base64 JSON blob.

### Scaffolding CLI (`bin/create.ts`, exposed as `cs-helper-create`)

Copies a template from `templates/<name>/` into a destination folder, replacing `%PACKAGE_NAME%`, `%PACKAGE_VERSION%`, `%PACKAGE_DESCRIPTION%`, `%V7%`, `%PLUGIN_VERSION%` placeholders in every non-binary file, then renames `index.{js,ts}` to `<packageName>.{js,ts}`. Optionally layers files from `ai-addons/<tool>/` (currently `cursor`, `claude`) on top with the same placeholder substitution — this is how generated projects get their own `.cursor/rules/` or `CLAUDE.md`. When editing `ai-addons/claude/CLAUDE.md`, remember it's a template for the *consumer's* repo (PhantomJS/Puppeteer version differences, `cs.log` vs `console.log`, `runApiRequest` auth/token-refresh, heartbeat/close lifecycle) — don't conflate its guidance with this repo's own build process.

- **`--update-ai`**: refreshes ai-addon files in an already-scaffolded project in place (no template/package.json touched), instead of the normal empty-destination scaffold flow. Reads `name`/`version`/`description` from the target's existing `package.json` and infers `v7` from its `scripts.build`; auto-detects which addons to refresh (via `bin/ai-addons.ts`'s `isAiAddonPresent`) when `--ai` isn't given.

### Ai-addon freshness (`bin/ai-addons.ts`)

Each ai-addon file embeds a hidden `cs-helper-addon-version: %PLUGIN_VERSION%` marker (an HTML comment in `CLAUDE.md`, a frontmatter field in the `.mdc` rule) substituted at scaffold/update time. `bin/build.ts` calls `checkAiAddonsFreshness(cwd, installedVersion)` near the start of every build and prints a non-fatal `console.warn` when a consumer project's marker doesn't match the running cs-helper version (`'stale'`) or is missing entirely on a file cs-helper clearly generated (`'unknown'` — pre-marker-feature scaffold). `ADDON_FILES` in that module is the single source of truth mapping an addon name to its checked file path; add an entry there when a new `ai-addons/<tool>/` gets a file worth tracking.

## Release process

- Two release channels via semantic-release (`.releaserc.json`, Angular commit preset): `main` (stable) and `develop` (`-beta.N` prerelease, `beta` channel). Workflows: `.github/workflows/release.yml` (main) and `release-beta.yml` (develop).
- Publishing to npm uses **npm trusted publishing** (OIDC from GitHub Actions on a `v*` tag), not a long-lived token — see `README.md` "Maintainers: publishing to npm" if changing the release workflow.
- Commit messages **must** follow the Angular/semantic-release format (`<type>(<scope>): <subject>`, types listed in `.releaserc.json`'s commit-analyzer config) — this directly drives version bumps and changelog generation, so it's not just a style preference.
