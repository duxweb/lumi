# Lumi Admin demo

Run the mock API with `pnpm --dir apps/admin mock` and the app with `pnpm --dir apps/admin dev`. The default URLs are `http://127.0.0.1:3002` and `http://127.0.0.1:5176`. Sign in with `admin/admin`, `manager/admin`, or `support/admin` to exercise different access policies.

Start at `/ui/overview` for the component directory or `/examples/forms/basic` for the first workflow example. The demo uses the same public Lumi components, native Catalog and provider contracts as applications.

- Overview: analysis dashboard, workbench and example library.
- Examples: basic, step, publishing and tabbed forms; list and detail patterns; results and recoverable states; native JSON interactions and connected queries.
- Components: text and choice inputs, form composition, data display, charts, feedback, surfaces and working overlays. Examples provide reset controls and expandable source Specs.
- Catalog / Content / System: connected business records, filters, row actions, detail pages, modal and drawer workflows, users and roles.
- Workspace: account center and grouped profile, notification, preference and security forms.

Component values use native state bindings. The Developer module (`/json/*`, `/backend/*`, `/ai/*`) shows each native Spec, HTTP exchange or tool call beside its live result against the mock API, with a Playground at `/json/playground`. `/examples/forms/basic` validates and creates a customer through the configured data provider. Mock records persist for the life of the mock process and reset when it restarts; notification sending and applying account preferences throughout a production host remain application responsibilities.

The exact comparison with Ant Design, Ant Design Pro and Tabler, including unsupported product capabilities, is in [the completeness review](../../tasks/demo-completeness-2026-09-21.md). New capabilities should ship working components and service contracts before adding menu entries.
