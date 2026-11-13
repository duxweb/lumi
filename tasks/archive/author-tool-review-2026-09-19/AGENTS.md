# AGENTS.md — Lumi build guide

Read `plan/README.md` first. It is the sole current architecture and migration plan. `plan/ui-design-spec.md` covers visual requirements; its migration addendum takes priority over legacy implementation notes. Historical snapshots in `tasks/archive/` are evidence, not instructions.

## Current status and migration scope

The target uses native json-render with three product layers: Lumi services, Lumi UI, and Lumi Admin. Only React is delivered now; framework-neutral entrypoints must allow a future implementation on `@json-render/vue`.

The codebase still contains the old 11 packages. Do not treat the target layout as already implemented. Follow P1–P5 in the plan, migrate useful behavior and consumers before deleting old packages, and do not revive the old Vue binding. Preserve the current working tree, including untracked implementations; Git HEAD is not a complete snapshot of this product.

## Target packages and entrypoints

| Directory | Package | Responsibility |
| --- | --- | --- |
| `packages/lumi` | `@duxweb/lumi` | Neutral providers, services, native Spec loading/validation; `/react` for framework hooks and optional setup |
| `packages/ui` | `@duxweb/lumi-ui` | Neutral component definitions; `/react` for owned shadcn-style UI and native registry; compiled CSS |
| `packages/admin` | `@duxweb/lumi-admin` | Neutral app/menu/route configuration; `/react` for Admin shell, routing and pages |
| `packages/check` | `@duxweb/lumi-check` | TypeScript CLI using the same Catalog validation as runtime |
| `packages/mcp` | `@duxweb/lumi-mcp` | Author tools consuming native Spec and application Catalog |
| `packages/create` | `@duxweb/create-lumi` | React scaffolding using the final public entrypoints |

Current `core`, `schema`, `runtime`, and `react` packages are migration sources; remove them after their useful behavior moves. Remove old `vue`. Rename/restructure `ui-shadcn` to `ui` and `admin-react` to `admin`. Keep the checker CLI but remove its old Rust/WASM implementation. Exact file ownership and removal gates are in plan §6 and §8.

## Native json-render contract

- Keep upstream Spec, Catalog, Registry, StateStore, handlers, on, watch, and binding syntax. Users familiar with json-render must be able to use Lumi directly.
- Use upstream core and the matching framework renderer. Do not fork the renderer, translate legacy SchemaNode trees, or retain RendererContract.
- Lumi adds data/request/auth/upload services, reusable handlers and connection components. JSON must support initial data loading, requests, mutations, refresh and component interactions through native extensions.
- Preserve native extension APIs and export composable definitions/registries/handlers. Convenience setup is optional; plain UI works under native json-render Providers/Renderer without Lumi data services.
- Catalog definitions are framework-free; assemble them using the appropriate upstream platform schema outside neutral entrypoints.
- JSON contains serializable values and registered actions, not executable code, arbitrary instance calls, or framework objects.
- Do not restore legacy scope/bind/when/action/command DSLs or compatibility aliases. Rewrite producers and consumers together.

## Layer and state ownership

- Neutral root entrypoints, service logic and Catalog definitions must not import React, Vue, DOM, or concrete UI implementations, including through type exports.
- React hooks, Context, effects and renderers live under explicit React entrypoints. Do not prebuild empty Vue modules.
- Lumi does not depend on UI/Admin. UI does not depend on Admin and does not execute remote queries or uploads.
- Admin React may directly use Lumi UI public React components. Raw Radix/shadcn/ReUI APIs stay private to UI internal source.
- DataProvider owns backend conventions; query bindings own remote cache; json-render StateStore owns editable page/form state; Admin owns shell state. Do not maintain duplicate editable form values.
- Use one service implementation for hooks and JSON handlers. Pass resource/dataProviderName directly; do not add Resource objects, registries, defineResource, useResource, or implicit CRUD derivation.
- Preserve list/aggregate snapshot consistency, auth cache isolation, dirty/draft/step validation, upload cancellation, routed-drawer guards and Shell mount stability from the current implementation.
- Component interactions use state bindings and registered actions; imperative ref operations remain in the framework layer.

## Code and dependencies

- Monorepo, pnpm, ESM-only, strict TypeScript. Source comments are English; architecture documents may be Chinese.
- Use `import type` and `export type` under verbatimModuleSyntax.
- Versions come from the pnpm catalog. Shared runtime singletons, including React, json-render, TanStack and workspace product packages, belong in peerDependencies + devDependencies.
- Framework peers must be optional for packages exposing neutral roots; verify actual installation and published entrypoint isolation.
- Do not change unrelated dependency versions during migration. Confirm compatible upstream/Zod versions before adoption.
- Keep UI compiled CSS, semantic tokens, HugeIcons, licensed owned sources, and optional chart loading. Do not create another palette.
- ReUI Pro source, assets, install commands, templates, icons, screenshots and visual baselines must never enter the repository or packages.
- Keep Changesets for versioning and release; do not hand-write publishing/topological scripts.

## Documentation and validation

Use Context7 for library/framework/API documentation: resolve the library ID, then query a specific concept. Use local code to assess existing behavior. Do not use library lookup for ordinary business-logic review or refactoring.

Read existing behavior tests before migration. Preserve useful behavioral regressions; replace tests of retired syntax with native Spec cases. CLI/MCP/runtime/docs must use the same Catalog definitions, not duplicate protocol tables.

Commands remain `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:schema`, and `pnpm e2e`. During migration, run relevant existing package commands; after cutover run the final root gates. `check:schema` will run the TypeScript native Spec checker. Update generated/size/tarball/isolation/release checks for six packages and their actual entrypoints; do not waive checks to remove a package.

Verify original json-render Providers/Renderer + Lumi registry, the convenience setup, neutral entrypoint installation without React, JSX/JSON UI parity, and the full data/form/Admin workflows. Historical passing results are not new migration acceptance.

## Ops Gotchas

Environment quirks a fresh agent will otherwise rediscover the hard way:

- **e2e reuses stale servers.** `playwright.config` sets `reuseExistingServer: !CI`, so a preview left on 4177-4181 is reused WITHOUT rebuilding — your changes won't appear. Kill them before `pnpm e2e`: `lsof -ti tcp:4177 tcp:4178 tcp:4179 tcp:4180 tcp:4181 | xargs kill`.
- **Mock state accumulates.** The React Admin mock server (port 3002, `apps/admin-react/mock`) holds data in memory. A long-lived mock left running across e2e runs keeps created rows, pushing new records onto page 2 → "row not visible" failures that look like regressions but are not. Kill stale mocks first: `pkill -9 -f "mock/server.mjs"`.
- **Shell noise.** Lines like `setValueForKeyFakeAssocArray: command not found: _encode` are harmless shell-profile noise, not command failures. Filter with `... | grep -vE "_encode|_decode"`.
- **Dev ports.** React Admin dev = 5176 (auto-bumps if busy) and its mock = 3002; react-demo = 5175, foundation-admin = 5177, docs = 5179, playground = 5180. Previews are 4176-4181. Kill leftover dev servers so you know which port serves the current code.
- **Teleported overlays inside drawers/modals.** A popover teleported to `body` (floating-ui / Ark positioner) gets a `transform`, so it forms its own stacking context; set its z-index on the positioner via inline `style` (not a utility class) or the overlay backdrop intercepts clicks. Overlay panels also need `overflow-y-auto` or tall forms overflow off-screen. Relevant when building adapter overlays.
