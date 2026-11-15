# AGENTS.md — Lumi build guide

Read `plan/README.md` first. It is the sole current architecture and migration plan. `plan/ui-design-spec.md` covers visual requirements.

## Current status and migration scope

The target uses native json-render with three product layers: Lumi services, Lumi UI, and Lumi Admin. Lumi is React-only (decided 2026-11-05; new project, Go backend over JSON/HTTP): do not add Vue or other framework entrypoints, optional framework peers or isolation for them. The only framework-free layer is each package's `/catalog` subpath (zod definitions and Spec validation), because `lumi-check` and server-side validation run in Node without React.

The source has been cut over to the five packages below. Current architecture and acceptance gates are defined in the plan; do not revive retired packages or the old Vue binding. Preserve the current working tree, including untracked implementations; Git HEAD is not a complete snapshot of this product.

## Target packages and entrypoints

| Directory | Package | Responsibility |
| --- | --- | --- |
| `packages/lumi` | `@duxweb/lumi` | Root: React providers, hooks, setup, data/request/auth/upload services and handlers; `/catalog`: framework-free definitions and Spec loading/validation |
| `packages/ui` | `@duxweb/lumi-ui` | Root: owned shadcn-style React UI and native registry; `/catalog`: framework-free component definitions; compiled CSS |
| `packages/admin` | `@duxweb/lumi-admin` | Root: React Admin shell, routing and pages; `/catalog`: app/menu/route schema and Admin definitions |
| `packages/check` | `@duxweb/lumi-check` | TypeScript CLI for authors: catalog lookup, component description and the same Catalog validation as runtime |
| `packages/create` | `@duxweb/create-lumi` | React scaffolding using the final public entrypoints |

The old core/schema/runtime/react/vue packages and Rust/WASM protocol engine are removed. Their useful services and behavior tests now live in Lumi; UI and Admin use explicit React entrypoints. Exact ownership and acceptance gates are in plan §6 and §8.

## Native json-render contract

- Keep upstream Spec, Catalog, Registry, StateStore, handlers, on, watch, and binding syntax. Users familiar with json-render must be able to use Lumi directly.
- Use upstream core and the matching framework renderer. Do not fork the renderer, translate legacy SchemaNode trees, or retain RendererContract.
- Lumi adds data/request/auth/upload services, reusable handlers and connection components. JSON must support initial data loading, requests, mutations, refresh and component interactions through native extensions.
- Preserve native extension APIs and export composable definitions/registries/handlers. Convenience setup is optional; plain UI works under native json-render Providers/Renderer without Lumi data services.
- Catalog definitions are framework-free; assemble them with `@json-render/react/schema` in the React root, never inside `/catalog`.
- JSON contains serializable values and registered actions, not executable code, arbitrary instance calls, or framework objects.
- Do not restore legacy scope/bind/when/action/command DSLs or compatibility aliases. Rewrite producers and consumers together.

## Layer and state ownership

- `/catalog` entrypoints and the pure service logic under `src/core` must not import React, DOM, or concrete UI implementations, including through type exports (ESLint enforces this).
- React hooks, Context, effects and renderers live in the React root entrypoints; do not create Vue or other framework modules.
- Lumi does not depend on UI/Admin. UI does not depend on Admin and does not execute remote queries or uploads.
- Admin React may directly use Lumi UI public React components. Raw Radix/shadcn/ReUI APIs stay private to UI internal source.
- DataProvider owns backend conventions; query bindings own remote cache; json-render StateStore owns editable page/form state; Admin owns shell state. Do not maintain duplicate editable form values.
- Use one service implementation for hooks and JSON handlers. Pass resource/dataProviderName directly; do not add Resource objects, registries, defineResource, useResource, or implicit CRUD derivation.
- Native validateForm does not gate subsequent actions. Lumi submission must await business validation, prevent duplicate saves, and close only after success; do not treat an action array as a transaction.
- Preserve list/aggregate snapshot consistency, auth cache isolation, dirty/draft/step validation, upload cancellation, routed-drawer guards and Shell mount stability from the current implementation.
- Component interactions use state bindings and registered actions; imperative ref operations remain in the framework layer.

## Code and dependencies

- Monorepo, pnpm, ESM-only, strict TypeScript. Source comments are English; architecture documents may be Chinese.
- Use `import type` and `export type` under verbatimModuleSyntax.
- Versions come from the pnpm catalog. Shared runtime singletons, including React, json-render, TanStack and workspace product packages, belong in peerDependencies + devDependencies.
- CLI/server implementation dependencies may be regular dependencies so tools install independently; preserve shared runtime peers where identity matters. Root development tooling belongs in devDependencies.
- React is a required peer of every package root. Only `/catalog` must import without React installed; verify it with the packed-tarball isolation smoke test.
- Do not change unrelated dependency versions during migration. Confirm compatible upstream/Zod versions before adoption.
- Keep UI compiled CSS, semantic tokens, HugeIcons, licensed owned sources, and optional chart loading. Do not create another palette.
- ReUI Pro source, assets, install commands, templates, icons, screenshots and visual baselines must never enter the repository or packages.
- Keep Changesets for versioning and release; do not hand-write publishing/topological scripts.

## Documentation and validation

Use Context7 for library/framework/API documentation: resolve the library ID, then query a specific concept. Use local code to assess existing behavior. Do not use library lookup for ordinary business-logic review or refactoring.

Read existing behavior tests before migration. Preserve useful behavioral regressions; replace tests of retired syntax with native Spec cases. CLI/runtime/docs must use the same Catalog definitions, not duplicate protocol tables.

Retain business validators and structured field errors; keep JSON Schema business validation optional. Delete the old Rust/WASM protocol engine. `lumi-check` is the one author tool: catalog lookup (`catalog`), component description (`describe`) and shared validation. `@duxweb/lumi-mcp` was removed on 2026-11-12 because the CLI covers the same three functions without a server to configure; do not add an MCP server back, and do not rebuild automatic value guessing or a simulated preview renderer. Follow plan §7 for tool and skill scope; the local Lumi skill describes repository-specific additions to upstream usage.

Commands remain `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:schema`, and `pnpm e2e`. `pnpm e2e` runs the `@smoke` tests (one key path per app); `pnpm e2e:full` runs everything and is what CI and `verify:release` use. While working, run the smoke tests plus the project you touched (`pnpm e2e:full --project=react-admin`); run the full suite once before a batch of changes is committed. Run the root gates; `check:schema` runs the TypeScript native Spec checker. Update generated/size/tarball/isolation/release checks for five packages and their actual entrypoints; do not waive checks to remove a package.

Verify original json-render Providers/Renderer + Lumi registry, the convenience setup, `/catalog` installation without React, JSX/JSON UI parity, and the full data/form/Admin workflows. Historical passing results are not new migration acceptance.

## Ops Gotchas

Environment quirks a fresh agent will otherwise rediscover the hard way:

- **Never kill processes.** Do not run `kill`, `pkill`, `killall` or `lsof … | xargs kill`, whether by port or by name. A port or command-line match cannot tell your processes from the user's, and `pkill -f <pattern>` also matches the shell running the command, which has killed the agent's own session. Inspect with `lsof -nP -iTCP -sTCP:LISTEN` (read-only). If something blocks a run, ask the user to stop it. Only stop a process you started yourself, through your task tool or its recorded PID.
- **e2e starts its own servers.** `playwright.config` reuses existing servers only when `LUMI_E2E_REUSE=1` is set. By default it builds and starts fresh previews and the mock, and fails with "port in use" if one is already listening. In that case report the listener; do not kill it.
- **Mock state accumulates.** The React Admin mock server (port 3002, `apps/admin/mock`) holds data in memory. A long-lived mock reused across runs (`LUMI_E2E_REUSE=1`) keeps created rows, pushing new records onto page 2. The resulting "row not visible" failures look like regressions but are not. Run without reuse, or ask the user to restart their mock.
- **Shell noise.** Lines like `setValueForKeyFakeAssocArray: command not found: _encode` are harmless shell-profile noise, not command failures. Filter with `... | grep -vE "_encode|_decode"`.
- **Dev ports.** React Admin dev = 5176 (auto-bumps if busy) and its mock = 3002; react-demo = 5175, foundation-admin = 5177, site (homepage, docs, Playground, demo) = 5179. Previews are 4176-4182. Check which listener serves which port before trusting what a URL shows.
- **Portaled overlays inside drawers/modals.** A popover portaled to `body` (Radix `Portal`; its Popper wrapper `[data-radix-popper-content-wrapper]` is positioned by floating-ui) gets a `transform`, so it forms its own stacking context; set its z-index on that wrapper via inline `style` (not a utility class) or the overlay backdrop intercepts clicks. Overlay panels also need `overflow-y-auto` or tall forms overflow off-screen. Relevant when building adapter overlays.
