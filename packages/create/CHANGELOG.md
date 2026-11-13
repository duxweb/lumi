# @duxweb/create-lumi

## 0.1.0

### Minor Changes

- A new project no longer gets a `.mcp.json`: the Lumi skill looks up components with `lumi-check catalog` and `lumi-check describe`, pinned to the scaffold's version, and `--no-ai` leaves out the skill alone.
- README lists `--no-ai`.
- 9434d31: Replace the unpublished Lumi page protocol and renderer with native json-render Spec, Catalog, Registry, StateStore and actions. Deliver three product layers with neutral roots and explicit React entrypoints: Lumi services, shadcn-style Lumi UI, and Lumi Admin. Migrate data, form, auth, upload and guarded routing behavior; share Catalog validation across runtime, the TypeScript checker, MCP, docs and React scaffolding.

  This is a breaking pre-1.0 cutover: remove the old core/schema/runtime/react/vue packages, old UI/Admin package names, RendererContract and Rust/WASM engine. Existing consumers must adopt native Spec and the new public entrypoints; no compatibility translator is included.

  Unify Admin forms and lists around separate section, summary, filter and result cards. Share typography, weight, radius, spacing and control tokens with Lumi UI, retain responsive page widths and existing save/validation/dirty guards, and scale default sizes with the root font size.

- 9434d31: Lumi is React-only. Package roots are now the React entries and the `/react` subpaths are removed; the only framework-free layer is each package's `/catalog` subpath, which lumi-check, lumi-mcp and server-side validation import in Node without React. React and the React-side libraries are now required peers of `@duxweb/lumi`, `@duxweb/lumi-ui` and `@duxweb/lumi-admin` (`@visactor/vchart`, `ajv` and `ajv-formats` stay optional).

  | Package              | Old import                                                                                                               | New import                        |
  | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
  | `@duxweb/lumi`       | `/react` subpath                                                                                                         | package root `@duxweb/lumi`       |
  | `@duxweb/lumi`       | root, for definitions, `validateDocument`, `validateConfig`, Spec loaders and `composeDefinitions` in Node without React | `@duxweb/lumi/catalog`            |
  | `@duxweb/lumi`       | root, for services, providers and handlers                                                                               | package root (unchanged)          |
  | `@duxweb/lumi-ui`    | `/react` subpath                                                                                                         | package root `@duxweb/lumi-ui`    |
  | `@duxweb/lumi-ui`    | root, for definitions, `themeConfigSchema` and theme/filter/chart definitions                                            | `@duxweb/lumi-ui/catalog`         |
  | `@duxweb/lumi-ui`    | `/react/charts` subpath                                                                                                  | `@duxweb/lumi-ui/charts`          |
  | `@duxweb/lumi-admin` | `/react` subpath                                                                                                         | package root `@duxweb/lumi-admin` |
  | `@duxweb/lumi-admin` | root, for manifest schema, app/menu/route config, menu/route helpers and the manifest loader                             | `@duxweb/lumi-admin/catalog`      |

  `@duxweb/lumi/catalog` additionally exports `createI18nProvider`, `extendI18nProvider`, `getLocaleDirection`, the i18n types and the `LumiContext` type for the Admin menu helpers; `@duxweb/lumi-admin/catalog` re-exports the `FilterOption` type.

- New projects are set up for AI authoring. Pages are JSON files under `src/pages`, and `src/catalog.mjs` is the one framework-free Catalog that the app, `npm run check` (lumi-check) and lumi-mcp all read. The scaffolder also writes a Lumi skill (`.claude/skills/lumi`, `.agents/skills/lumi`) that has agents look up the Catalog, write native Spec and validate before finishing, and a project `.mcp.json` that starts lumi-mcp over that Catalog. Pass `--no-ai` to leave the skill and MCP config out.
