# AGENTS.md — Lumi build guide for AI agents

Operating manual for AI/developers implementing **Lumi**.

**Read first:** `plan/README.md`. The plan directory intentionally contains one current handoff document; use git history for retired workstream details.

## TL;DR

- Monorepo · pnpm · ESM-only · TypeScript strict.
- Final product stack: `lumi-core` + `lumi-schema` + `lumi-runtime` + `lumi-react` + `lumi-ui-shadcn` + `lumi-admin-react` + `lumi-check` + `lumi-mcp` + `create-lumi` + `lumi`.
- `lumi-vue` remains a headless binding only. It is not a current UI/Admin delivery target.
- `lumi-ui-shadcn` is the only concrete UI adapter. `lumi-admin-react` receives a neutral `RendererContract` and must not import that adapter directly.
- Code comments in source files must be English. Architecture docs and plan docs may be Chinese.

## Target Repo Layout

| dir | package | layer | build |
| --- | --- | --- | --- |
| `packages/core` | `@duxweb/lumi-core` | pure TS headless core | tsdown |
| `packages/schema` | `@duxweb/lumi-schema` | schema protocol + RendererContract | tsdown |
| `packages/react` | `@duxweb/lumi-react` | React headless binding | vite |
| `packages/vue` | `@duxweb/lumi-vue` | maintained Vue headless binding | vite |
| `packages/ui-shadcn` | `@duxweb/lumi-ui-shadcn` | Radix + shadcn React RendererContract adapter | tsdown |
| `packages/admin-react` | `@duxweb/lumi-admin-react` | React Admin product layer | tsdown |
| `packages/runtime` | `@duxweb/lumi-runtime` | framework-neutral JSON runtime | vite |
| `packages/mcp` | `@duxweb/lumi-mcp` | AI/MCP tools | tsdown |
| `packages/create` | `@duxweb/create-lumi` | scaffolding CLI | tsdown |
| `packages/lumi` | `@duxweb/lumi` | umbrella, no concrete UI binding | tsdown |
| `apps/admin-react` | private | React Admin dogfood and visual acceptance app | vite |

`@duxweb/lumi-ui`, `lumi-primitives`, `lumi-preset`, `lumi-ui-recipes`, `lumi-ui-hero`, `lumi-ui-nuxt`, `lumi-admin-vue`, and `lumi-admin-vue-cdn` were deleted, along with HeroUI, Nuxt UI, UnoCSS, and the `design/` reference drafts. Do not reintroduce any of them, their private CSS variables, or a second executable palette; use git history if you need the retired details.

## Hard Conventions

1. Source code comments are English only.
2. ESM only. `verbatimModuleSyntax` is on, so use `import type` and `export type` for type-only imports/exports.
3. One package has one responsibility. Entry is `src/index.ts`.
4. Package names follow `@duxweb/lumi-<part>`. Admin packages use framework suffix: `lumi-react` -> `lumi-admin-react`.
5. Shared singletons go in `peerDependencies + devDependencies`, never regular `dependencies`: `vue`, `vue-router`, `react`, `react-dom`, Radix, TanStack Query/Table/Virtual, chart libraries, and `@duxweb/lumi-*`.
6. Versions come from the pnpm catalog in `pnpm-workspace.yaml`.
7. `lumi-core` must not import any framework or UI library.
8. `lumi-schema` must not import any framework or UI library.
9. UI adapters implement `RendererContract`; do not bypass it.
10. Admin components receive a `RendererContract`; they must not directly import concrete UI adapters.
11. Do not expand Vue UI/Admin delivery. Changes to shared headless behavior must not silently drift between maintained bindings.
12. `lumi-schema` is the sole neutral source for standard component names and props. Standard schema nodes must not use adapter-private props.
13. The public adapter export is neutral (`reactAdapter`). Raw Radix, shadcn, and ReUI component APIs remain private under `ui-shadcn/internal`.
14. ReUI Pro source, assets, templates, icons, install commands, screenshots, and visual baselines must never enter the repository or a published package.

## Layer Rules

### `@duxweb/lumi-core`

Allowed:

- Provider interfaces.
- `createLumi`.
- `resolveDataTarget` and query-key helpers.
- `simpleDataProvider`.
- `Validator` and structured validation issues.
- Pure expression/data helpers.

Forbidden:

- Vue/React imports.
- Concrete UI-library imports.
- `useModal`, `useDialog`, `useDrawer`.
- CRUD page components.

### `@duxweb/lumi-schema`

Allowed:

- `SchemaNode`, `LumiSchemaDocument`, `LumiAdminManifest`.
- `RendererContract`.
- Schema validation and structured errors.
- The complete neutral component-props map.

Forbidden:

- Framework code.
- UI adapter code.
- Component implementation details.

### `@duxweb/lumi-vue`

Allowed:

- `createVueRenderer`.
- `createLumiVue`, `LumiProvider`, `LumiRender`.
- Vue composables matching the React binding surface: `useList`, `useOne`, `useMany`, `useInfiniteList`, `useCustom`, `useClient`, `useInvalidate`, `useCreate`, `useCreateMany`, `useUpdate`, `useUpdateMany`, `useDelete`, `useDeleteMany`, `useCustomMutation`, `useForm`, `useValidator`, `useTable`.
- Auth/access/i18n/router composables: `useLogin`, `useLogout`, `useCheck`, `useIdentity`, `usePermissions`, `useCan`, `useTranslate` or `useI18n`, `useNavigation`, `useParsedLocation`.
- `useOverlay`, `useModal`, `useDialog`, `useDrawer`, `OverlayHost`.
- `useUpload`.

Forbidden:

- `LumiCrud`.
- `useResource` or Resource registration.
- Admin shell/layout.
- Login page.
- Resource route/menu generation.
- Concrete UI-library mappings.

### `@duxweb/lumi-react`

Allowed:

- `createReactRenderer`.
- `createLumiReact`, `LumiProvider`, `LumiRender`.
- React hooks matching the Vue binding surface: `useList`, `useOne`, `useMany`, `useInfiniteList`, `useCustom`, `useClient`, `useInvalidate`, `useCreate`, `useCreateMany`, `useUpdate`, `useUpdateMany`, `useDelete`, `useDeleteMany`, `useCustomMutation`, `useForm`, `useValidator`, `useTable`.
- Auth/access/i18n/router hooks: `useLogin`, `useLogout`, `useCheck`, `useIdentity`, `usePermissions`, `useCan`, `useTranslate` or `useI18n`, `useNavigation`, `useParsedLocation`.
- `useOverlay`, `useModal`, `useDialog`, `useDrawer`, `OverlayHost`.
- `useUpload`.

Forbidden:

- Admin shell/layout.
- Login page.
- Resource route/menu generation.
- Concrete UI-library mappings.
- Admin product components.

### `@duxweb/lumi-ui-shadcn`

Allowed:

- React wrappers implementing `RendererContract`.
- Radix and owned shadcn/ReUI MIT source for interaction, state, focus, and accessibility.
- TanStack Table/Virtual and VChart for their declared neutral components.
- Adapter capabilities.
- Contract-level field controls and atomic UI components.
- Neutral wrappers for every standard Schema component.
- Theme token projection and package-owned compiled CSS.

Forbidden:

- Business flows.
- Data-resource routing.
- Admin imports.
- Retired UI package imports or ReUI Pro content.
- Raw Radix, shadcn, or ReUI components registered directly as standard contract components.
- Query, remote-options, or upload execution logic.

### `@duxweb/lumi-admin-react`

Allowed:

- Shell provider/facade, single/dual/custom Shells, menu, breadcrumbs, tabs, login, auth guard, and Admin page composition.
- Explicit Schema routes, Manifest lifecycle helpers, and `createAdmin` assembly.

Forbidden:

- Defining core providers or implementing a UI component library.
- Directly importing `@duxweb/lumi-ui-shadcn`, Radix, shadcn, or ReUI.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm lint
pnpm changeset
```

Targeted examples:

```bash
pnpm -F @duxweb/lumi-core typecheck
pnpm -F @duxweb/lumi-schema typecheck
pnpm -F @duxweb/lumi-react typecheck
pnpm -F @duxweb/lumi-vue typecheck
pnpm -F @duxweb/lumi-ui-shadcn typecheck
pnpm -F @duxweb/lumi-admin-react typecheck
```

## AI Loop

For schema-driven work:

```text
generate schema -> validate_document -> fix structured errors -> lumi-check -> typecheck -> smoke test
```

For architecture migration:

```text
read plan/README.md -> update imports/deps -> typecheck -> test/build
```

## Ops Gotchas

Environment quirks a fresh agent will otherwise rediscover the hard way:

- **e2e reuses stale servers.** `playwright.config` sets `reuseExistingServer: !CI`, so a preview left on 4177-4181 is reused WITHOUT rebuilding — your changes won't appear. Kill them before `pnpm e2e`: `lsof -ti tcp:4177 tcp:4178 tcp:4179 tcp:4180 tcp:4181 | xargs kill`.
- **Mock state accumulates.** The React Admin mock server (port 3002, `apps/admin-react/mock`) holds data in memory. A long-lived mock left running across e2e runs keeps created rows, pushing new records onto page 2 → "row not visible" failures that look like regressions but are not. Kill stale mocks first: `pkill -9 -f "mock/server.mjs"`.
- **Shell noise.** Lines like `setValueForKeyFakeAssocArray: command not found: _encode` are harmless shell-profile noise, not command failures. Filter with `... | grep -vE "_encode|_decode"`.
- **Dev ports.** React Admin dev = 5176 (auto-bumps if busy) and its mock = 3002; react-demo = 5175, foundation-admin = 5177, docs = 5179, playground = 5180. Previews are 4176-4181. Kill leftover dev servers so you know which port serves the current code.
- **Teleported overlays inside drawers/modals.** A popover teleported to `body` (floating-ui / Ark positioner) gets a `transform`, so it forms its own stacking context; set its z-index on the positioner via inline `style` (not a utility class) or the overlay backdrop intercepts clicks. Overlay panels also need `overflow-y-auto` or tall forms overflow off-screen. Relevant when building adapter overlays.

## Do Not

- Do not add new code to retired UI/Admin packages or Vue UI applications.
- Do not import `vue`/UI libs into `lumi-core`.
- Do not import `vue`/UI libs into `lumi-schema`.
- Do not keep business components in `lumi-vue`.
- Do not add Resource objects, registries, `defineResource`, `useResource`, or implicit CRUD derivation.
- Do not make the RendererContract match Radix, shadcn, ReUI, HeroUI, Nuxt UI, or any concrete library props directly; keep it neutral.
- Do not preserve obsolete component names, private props, package aliases, migrations, or runtime fallbacks.
- Do not import, download, snapshot, or package ReUI Pro content.
- Do not hand-write publish/topological scripts. Changesets handles release flow.
