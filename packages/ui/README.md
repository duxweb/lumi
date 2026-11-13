# @duxweb/lumi-ui

Owned shadcn-style UI for native json-render. Import definitions from `@duxweb/lumi-ui/catalog`, React components and uiRegistry from `@duxweb/lumi-ui`, and compiled CSS from `@duxweb/lumi-ui/style.css`.

Pass uiRegistry directly to upstream JSONUIProvider and Renderer. Plain UI has no Lumi data-service dependency. JSX and JSON use the same controlled components; bindings update before events. Add custom components with upstream defineCatalog/defineRegistry.

Only `/catalog` is framework-free and imports without React. React, Radix, TanStack Table and the other React-side libraries are required peers of the root entry (the create-lumi template supplies them); `@visactor/vchart` stays optional for charts.

Use semantic CSS tokens and applyLumiTheme for theme seeds. The component definitions in `/catalog` are the source for runtime, author tools and docs. Requests, uploads and routing belong in Lumi services or Admin; LumiUpload receives an onUpload callback and URLs.

Optional charts: import LumiChart/chartRegistry from `@duxweb/lumi-ui/charts` and install @visactor/vchart. The engine loads on demand. Public chart props describe points, formatting and accessibility, not VChart internals.

Radix, shadcn and MIT ReUI implementations remain private. HugeIcons uses the free Stroke Rounded set. See LICENSES, THIRD_PARTY_NOTICES.md and upstream-manifest.json for source provenance. No Pro assets are distributed.

Public design tokens are defined in `src/tokens.css` and included in `style.css`: `--lumi-fs-*` for semantic typography, `--lumi-font-weight-*`, `--lumi-radius-control/panel/overlay`, `--lumi-space-*`, and `--lumi-control-sm/md/lg/touch`. UI components and Admin consume this same scale. Default controls and panels use a 6px radius, overlays use the larger step, and existing theme radius/font seeds remain configurable. The neutral workspace surface is `--lumi-surface-workspace`; applications should consume it instead of inventing their own gray palette.

Default typography, spacing and control sizes use rem and scale with the root font size. Explicit `fontSizes` theme seeds override individual type steps.
