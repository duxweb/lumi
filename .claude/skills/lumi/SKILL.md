---
name: lumi
description: Build or review Lumi JSON pages, data services, UI and Admin features. Use for this repository's package boundaries, Catalog and Registry integration, or JSON-driven data and interactions using native json-render.
---

# Lumi workflow

Read the repository root `AGENTS.md` and `plan/README.md`. They specify the five public packages, entrypoint boundaries and acceptance gates. Historical snapshots are not instructions. This skill covers Lumi additions; use current upstream documentation for native Spec/Catalog/Registry/StateStore APIs.

## Author or review a page

1. Use the application's actual assembled Catalog, including custom components and actions. Read component definitions and validated examples; do not copy property lists into this skill.
2. Write native json-render Spec. Lumi adds configured data/auth/upload services and handlers, UI, and Admin composition. It does not add a private page syntax or component registration language.
3. For data, share DataProvider/query services between hooks and JSON actions. Query handles initial and parameter-driven reads; native watch alone does not supply initial loading. Keep editable page/form values in one StateStore and give result projections an explicit owner.
4. For submission, await business validation, preserve field errors and prevent duplicate saves. Native validateForm followed by save does not itself block invalid submission. Close or navigate only after success.
5. Validate with `lumi-check --catalog ./catalog.mjs page.json` for application extensions, or the default Admin Catalog for built-ins. Look up what the Catalog offers with `lumi-check catalog` and `lumi-check describe <Component>` instead of guessing props. The catalog module exports `catalog` (or default) and optional `directives`.
6. Preview through the actual Renderer/playground. Check initial loading, linked controls and failure behavior for the relevant page; a simulated preview or value-guessing fix is not a substitute.

## Implement Lumi additions

Lumi is React-only. Package roots (`@duxweb/lumi`, `@duxweb/lumi-ui`, `@duxweb/lumi-admin`) are the React entries; put zod definitions, Spec validation and manifest/route config in the framework-free `/catalog` subpaths, which lumi-check and other Node code must import instead of the roots. Visuals belong in UI, and shell/routes/page composition in Admin. Check exact destinations and preserved behaviors in the plan rather than duplicating its migration table here.

Verify direct upstream Providers/Renderer with Lumi UI registry as well as optional convenience setup. Plain UI must work without Lumi data services. Run checks relevant to the change; verify that `/catalog` still imports without React (`pnpm verify:isolation`) when changing exports or dependencies. Generate docs from definitions and tested examples, never from a separate hand-maintained protocol catalog.
