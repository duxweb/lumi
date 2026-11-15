# Lumi

Lumi builds admin interfaces from JSON. Pages are native [json-render](https://json-render.dev) Specs; Lumi adds the data, request, auth and upload services they need, a React UI library, and a complete Admin shell. A backend in any language can serve the pages, menus and data over JSON/HTTP, and a deployment needs no frontend build.

Documentation (Chinese) lives in `apps/site`; run `pnpm site:dev` and open http://127.0.0.1:5179.

GitHub Pages deploys the homepage, docs, Playground and full browser demo together on every push to `main`, through `.github/workflows/pages.yml`. Enable GitHub Actions as the repository's Pages source. The demo lives at `demo/` beneath the site URL and uses browser mock data; it needs no backend server. `LUMI_SITE_BASE` and `LUMI_SITE_URL` configure the deployment path and origin. The site E2E tests use `/lumi/` by default to cover repository Pages hosting; set `LUMI_SITE_BASE=/` to check a root deployment.

## Packages

| Package | What it is |
| --- | --- |
| `@duxweb/lumi` | React providers and hooks, data/request/auth/upload services and JSON action handlers. `/catalog` holds the framework-free definitions and Spec validation. |
| `@duxweb/lumi-ui` | The React UI components and their json-render registry, with compiled CSS. |
| `@duxweb/lumi-admin` | The Admin shell, routing and pages, and the prebuilt no-build base (`dist/base`). |
| `@duxweb/lumi-check` | `lumi-check`, a CLI that looks up the Catalog (components, actions, one component's props) and validates Specs, manifests, themes and `config.json` against it. |
| `@duxweb/create-lumi` | `pnpm create @duxweb/lumi my-app`, a React scaffold. |

Lumi is React-only. Only the `/catalog` subpaths import without React, for Node tools and server-side validation.

## Repository layout

- `packages/`: the five published packages above.
- `apps/admin`: the Admin demo and its mock API. `apps/site`: the website, docs and playground. `apps/json-api`: a demo backend serving pages as JSON.
- `examples/`: `base-admin` (static HTML and JSON, no build), `foundation-admin`, `react-demo`, and the shared `schema-gallery` fixtures.
- `plan/README.md`: the architecture. `AGENTS.md`: rules for contributors and coding agents. `CONTRIBUTING.md`: how to send a change.

## Development

Node 22.12 or later and pnpm 9.

```sh
pnpm install
pnpm --dir apps/admin mock   # mock API on 3002
pnpm --dir apps/admin dev    # Admin demo on 5176 (admin / admin)
```

| Command | What it checks |
| --- | --- |
| `pnpm typecheck` | TypeScript in every package and app |
| `pnpm lint` | ESLint, including the package boundary rules |
| `pnpm test` | Unit and component tests (Vitest) |
| `pnpm check:schema` | Every JSON page in the repository against the Catalog |
| `pnpm build` | All packages and apps |
| `pnpm e2e` | One key browser path per app; `pnpm e2e:full` runs everything |
| `pnpm verify:ci` | Everything CI runs except the browser tests |

Reference docs under `apps/site` are generated from the Catalog definitions: after changing a definition or a public export, run `pnpm -F @duxweb/lumi-site generate` and `pnpm gen:llms`. Versioning and release go through Changesets (`pnpm changeset`).

## License

MIT
