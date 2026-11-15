# @duxweb/lumi-check

## 0.1.1

### Patch Changes

- e0e8013: Share session identity across derived contexts and guard writes, imports, optimistic rollback, placeholder rows and remote page caches across account or tenant changes. Prevent signed HTTP redirects from forwarding custom credentials and reject nested mutating agent UI actions.

  Unify CRUD parameter mapping, preserve JSON delete values, validate native action parameters and required record IDs, and reuse provider URL resolution for agent requests. Keep list and aggregate refreshes consistent and reset pagination when filters change.

  Separate Admin document loading and Avatar primitives, and reduce redundant test loading, fixed waits and duplicate accessibility scans while preserving integration and visual coverage.

- Updated dependencies [e0e8013]
  - @duxweb/lumi@0.1.1
  - @duxweb/lumi-ui@0.1.1
  - @duxweb/lumi-admin@0.1.1

## 0.1.0

### Minor Changes

- `lumi-check catalog` lists the Catalog's components and actions as JSON (`--kind components|actions`, `--name` for one, an action then with its params), and `lumi-check describe <Component>` prints one component's props schema, slots and events; the library exports them as `getCatalog` and `describeComponent`. They replace `@duxweb/lumi-mcp`, which is removed: its three tools were these two lookups and this package's validation.
- `--kind config` checks the prebuilt base's `config.json`, the pages of an inline manifest with it; `checkDocument` takes the same kind and `DOCUMENT_KINDS` lists them.
- Validation no longer skips props or action params that contain a key such as `$state`, and reports a component or action named like an inherited object member as unknown instead of crashing (see `/lumi`).
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

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies [55ba4ec]
- Updated dependencies [1b99427]
- Updated dependencies
- Updated dependencies [1d9b6fc]
- Updated dependencies [218f591]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [f22bcba]
- Updated dependencies
- Updated dependencies [d1fb343]
- Updated dependencies [9434d31]
- Updated dependencies
- Updated dependencies [ce18374]
- Updated dependencies [86bc9a5]
- Updated dependencies [35b253b]
- Updated dependencies
- Updated dependencies
- Updated dependencies [9434d31]
- Updated dependencies [9434d31]
- Updated dependencies
- Updated dependencies
- Updated dependencies [c58c775]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [9434d31]
- Updated dependencies
- Updated dependencies
- Updated dependencies [9434d31]
- Updated dependencies [9434d31]
- Updated dependencies [8234530]
- Updated dependencies
- Updated dependencies [0e4ceb7]
- Updated dependencies [b85982d]
- Updated dependencies [1e90575]
- Updated dependencies
- Updated dependencies [4c082aa]
- Updated dependencies [e9efd48]
- Updated dependencies
- Updated dependencies [a0ba52d]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [31445bb]
- Updated dependencies [2321174]
- Updated dependencies
- Updated dependencies
- Updated dependencies [000a102]
- Updated dependencies
- Updated dependencies [04fe79e]
- Updated dependencies [9434d31]
- Updated dependencies [1d9b6fc]
- Updated dependencies
- Updated dependencies
- Updated dependencies [1d9b6fc]
- Updated dependencies
- Updated dependencies [9434d31]
- Updated dependencies [b82b21a]
- Updated dependencies
- Updated dependencies
- Updated dependencies [bd2134b]
- Updated dependencies [118b9d4]
- Updated dependencies
  - @duxweb/lumi@0.1.0
  - @duxweb/lumi-admin@0.1.0
  - @duxweb/lumi-ui@0.1.0
