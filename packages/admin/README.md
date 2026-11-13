# @duxweb/lumi-admin

Admin configuration and React application foundation built on Lumi services and Lumi UI.

The `@duxweb/lumi-admin` root exports createAdmin, Shell, page components, adminCatalog and adminRegistry. The framework-free `/catalog` subpath exports app/menu/route/manifest schemas, menu helpers, remote manifest loading and component/action definitions. Load UI and Admin compiled style.css in your application.

createAdmin receives a Lumi context, manifest, optional theme, and optional native catalog/registry/handlers. A route's page is one of `{ spec }` (inline), `{ src }` (a JSON page, loaded and validated), `{ module }` (an ES module from your own site, loaded with `import()`) or `{ iframe }` (another site, limited by `frameOrigins`). Custom components use upstream registration; a JSON page never carries executable code.

No-build deployments use the prebuilt base in `dist/base` (`lumi-admin.js` and `lumi-admin.css`, served from your backend or a CDN): one `config.json` describes the backends, sign-ins, permission rules and one or several panels, and plain ES extension modules add components, actions and providers. Compiled hosts call the same `mountAdmin(config, extensions)`.

Admin UI includes Dashboard, List, Form, Detail and Settings pages, shared grids/filters/states, guarded routed drawers, login, menu search, tabs and theme selection. Shell state is separate from native editable page StateStore and remote QueryClient cache. Apps can directly compose public React components or render the native Admin registry.

All default pages share a centered responsive `LumiPage` container: at most 1280px including side gutters (16px on desktop, 12px on mobile), shrinking to the available width on smaller screens. Titles, toolbars and content stay aligned across page types, and nested pages do not duplicate gutters. Override `--lumi-admin-content-max-width` on the application container to change this limit once for all pages. Explicit `Page.width="content"` narrows a reading surface to 880px; `full` fills its parent for custom layouts.

Forms use independent section cards with an optional `aside` for every layout (`centered`, `publish`, `tabs`, `steps`). Lists separate summary cards, filters and results; saved views lead the results panel. Short lists keep their natural height. The workspace, typography, radii and spacing consume public Lumi UI tokens instead of maintaining an Admin scale.

Settings use horizontal category tabs and independent group cards. `LumiSettingsRow` places its heading above the fields and its `actions` in a separate footer. Give each editable group its own form values and save/reset actions, and combine their dirty flags for `LumiSettingsPage`. Page-level actions appear once in the footer; read-only sections can set `actions: false`.

The React Admin demo includes Profile, Notifications, Preferences and Security examples, with left-aligned descriptions and right-aligned switches inside each group. Each group saves its own fields through the mock data provider and restores them on reload. Notification delivery and applying saved preferences to a real application's language, tabs or guards are host responsibilities; the demo illustrates the settings form and persistence flow.

Lumi is React-only. React and the other React-side libraries are required peers; only `/catalog` imports without React.
