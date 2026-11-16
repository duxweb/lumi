# Contributing

Thanks for helping with Lumi. The short version: read `AGENTS.md` and `plan/README.md` first, keep a change inside the package that owns it, and run the checks before you open a pull request.

## Setup

Node 22.12 or later and pnpm 9.

```sh
pnpm install
pnpm --dir apps/admin mock   # mock API on 3002
pnpm --dir apps/admin dev    # Admin demo on 5176
```

## Where things go

- `packages/lumi`: data, request, auth and upload services (`src/core`, framework-free), React hooks and providers (`src/react`), definitions and validation (`src/catalog`).
- `packages/ui`: React components and their json-render registry. It never fetches or uploads.
- `packages/admin`: the shell, routing and pages. It uses only the public components of `packages/ui`.
- `/catalog` entry points and `src/core` must not import React or DOM modules; ESLint enforces it.

A component's props, events and slots are defined once, in its package's `/catalog`. The runtime, `lumi-check` and the reference docs all read that definition.

## Before a pull request

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm check:schema
pnpm e2e                    # one key browser path per app
```

- Add a test for a behaviour you fix or add; tests fail on unexpected `console.error` output.
- After changing a Catalog definition or a public export, regenerate the reference docs: `pnpm -F @duxweb/lumi-site generate && pnpm gen:llms`. Hand-written guides live in `apps/site/src/content/docs/guide`; `pnpm -F @duxweb/lumi-site check` validates their code examples.
- Describe user-visible changes with `pnpm changeset`.
- Source comments are in English.

`pnpm verify:ci` runs everything CI runs except the browser tests.

GitHub reports Lint/source checks, TypeScript, unit tests, build/package checks and E2E separately. The same reusable workflow runs for pull requests and `main`, and gates stable-tag publishing. Prepare versions with `pnpm run version`; after reviewing and pushing those changes to `main`, push the matching `v<major>.<minor>.<patch>` tag. `Publish` runs full CI, validates all five versions, consumed changesets and main ancestry, then publishes through Changesets and creates a GitHub Release. Ordinary branch pushes never publish. E2E uses the pinned Playwright image in `ci.yml` and `visual-baselines.yml`. To add or update Linux screenshots, run the manual Visual baselines workflow, inspect its artifact and commit the complete `*-linux.png` set; ordinary CI compares committed baselines.
