# Lumi Agent Guide

This file is the short agent entrypoint for Lumi. Read the root `AGENTS.md` and `plan/README.md` before implementation work.

## Default Loop

1. Inspect the existing package README and nearby source.
2. Query the Lumi Catalog before guessing components or props.
3. Use Lumi MCP in this order: `get_catalog` / `describe_component` → `generate_page` or `generate_manifest` → `validate_document` → `explain_errors` / `fix_document` → `preview`.
4. Run `lumi-check`, targeted tests, typecheck, and the relevant build.

## Hard Rules

- Source comments are English only.
- Use ESM and `import type` for type-only imports.
- Shared singletons belong in `peerDependencies` and `devDependencies`, not `dependencies`.
- `@duxweb/lumi-core` and `@duxweb/lumi-schema` must stay framework-free.
- RendererContract stays neutral; do not shape it around one UI adapter.
- React Admin is the only current UI product. Keep Vue as a headless binding and do not add Vue UI/Admin work.
- `@duxweb/lumi-ui-shadcn` is the only concrete adapter; raw Radix, shadcn, and public MIT ReUI source stay private to that package.
- Do not add compatibility aliases, migrations, fallbacks, or ReUI Pro content.
- Pass `resource + dataProviderName` directly to hooks, Service nodes, Forms, and Actions.
- Do not add Resource objects, registries, `defineResource`, `useResource`, or implicit CRUD derivation.

## Golden Data Path

```text
resource + dataProviderName
  → Core selects DataProvider
  → DataProvider interprets the string target
  → explicit Schema page
  → framework renderer
  → RendererContract
  → UI adapter
```
