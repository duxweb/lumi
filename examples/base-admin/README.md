# Lumi base example

The Admin with no build step: `public/` holds an HTML page, JSON files and one
plain JavaScript extension; the front end is the prebuilt base from
`@duxweb/lumi-admin` (`dist/base/lumi-admin.js` and `.css`).

```sh
pnpm -F @duxweb/lumi-admin build      # once: produces dist/base
node apps/admin/mock/server.ts  # the demo API on :3002
node examples/base-admin/serve.mjs    # http://127.0.0.1:5182
```

| File | Role |
| --- | --- |
| `public/index.html` | Loads the base, points it at `config.json`, adds `window.LumiAdminSetup` callbacks and an inline Strapi data provider through `LumiAdmin.use()` |
| `public/config.json` | Backends (`data`), sign-in (`auth`), the panel with its manifest, theme, translations and extension modules (`adminBaseConfigSchema`) |
| `public/manifest.json` | Menu and routes; each page is a JSON Spec |
| `public/locales/*.json` | Messages per locale, referenced by `labelKey` |
| `public/ext/order-summary.js` | Plain ES module: registers `OrderSummary`, reads orders with `useList` from `runtime` |

In production the base can come from a CDN instead of `/lumi/`, for example
`https://cdn.jsdelivr.net/npm/@duxweb/lumi-admin@<version>/dist/base/lumi-admin.js`.
