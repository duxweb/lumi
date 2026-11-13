---
name: lumi
description: Build, review, or repair Lumi Schema pages and Admin Manifests with the Lumi Catalog, MCP tools, checker, framework bindings, UI adapters, and Admin packages. Use for Lumi JSON generation, data-provider integration, Vue/React rendering, custom components, validation, or architecture changes in this repository.
---

# Lumi Workflow

1. Read `AGENTS.md` and `plan/README.md`.
2. Query the current Catalog with Lumi MCP `get_catalog`; use `describe_component` for exact neutral props.
3. Generate Schema with `generate_page` or routes with `generate_manifest`.
4. Run `validate_document`; use `explain_errors` and `fix_document` only for deterministic repairs.
5. Use `preview` for a structural check, then render through the React binding and `ui-shadcn` adapter.
6. Run `lumi-check`, targeted typecheck/tests, and the relevant application build.

## Data

- Pass `resource` and optional `dataProviderName` directly from hooks, Service nodes, Forms, and Actions.
- Do not create or register Resource objects. Do not add `defineResource`, `useResource`, `ResourceRegistry`, or `createLumi({ resources })`.
- Let each DataProvider interpret resource strings and assemble URLs, parameters, request bodies, and response mapping.
- Put page defaults in `useForm.initialValues` or `Form.props.data`.
- Inject a `Validator` for business data rules; select rules by the resource string.

## Boundaries

- Keep Core and Schema free of framework and UI imports.
- Keep Schema props library-neutral; use `component` and a trusted `RendererContract.custom` entry for extensions.
- Keep Manifest limited to routes, menus, permissions, and page sources.
- Treat React Admin as the only current UI product; Vue remains headless only.
- Keep raw Radix, shadcn, and public MIT ReUI source private to `ui-shadcn`; never use ReUI Pro content.
- Remove obsolete protocol and package paths instead of preserving compatibility aliases or fallbacks.
- Use MCP and Catalog as protocol truth; do not copy component parameter tables into this Skill.

## Output

- Emit JSON-serializable Schema and Manifest values only.
- Use explicit `scope.<name>` paths and stable scope names.
- Reject UI-library-private props, remote executable code, and hidden CRUD derivation.
