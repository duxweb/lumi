---
name: lumi
description: Write, change or fix Lumi pages in this project. Use when adding or editing a page Spec under src/pages, when asked which components or actions exist, when a page fails lumi-check, or when wiring data, forms or actions into a page.
---

# Writing Lumi pages

A Lumi page is a native json-render Spec: plain JSON that the app renders with the components and actions in `src/catalog.mjs`. You change the JSON, not React code, and nothing needs to be built to see the result. The Catalog is the boundary: a page may only use what it lists. That keeps every page inside the same design system and the same backend contract.

Work in this order and do not skip the last step.

## 1. Look up what exists

Never guess a component, prop, event or action from memory or from other libraries.

Look them up on the command line. Both commands print JSON and read the same Catalog as the app:

```sh
# Every component and action, with a one-line description (--kind components or actions narrows it)
npx -y @duxweb/lumi-check@{{LUMI_VERSION}} catalog --catalog src/catalog.mjs
# One component: its props as JSON Schema, slots and events
npx -y @duxweb/lumi-check@{{LUMI_VERSION}} describe Table --catalog src/catalog.mjs
# One action with its params
npx -y @duxweb/lumi-check@{{LUMI_VERSION}} catalog --kind actions --name submitForm --catalog src/catalog.mjs
```

Describe each component you use before writing its props.

If the app needs something the Catalog lacks, stop and add it to `src/catalog.mjs` and the registry in `src/App.tsx` (step 4) instead of approximating it with other components.

## 2. Write the Spec

```json
{
  "root": "page",
  "state": { "filters": { "status": "paid" } },
  "elements": {
    "page": { "type": "Stack", "props": {}, "children": ["orders-query", "orders"] },
    "orders-query": {
      "type": "Query", "children": [],
      "props": { "resource": "orders", "operation": "list", "resultPath": "/orders" }
    },
    "orders": {
      "type": "Table", "children": [],
      "props": { "rows": { "$state": "/orders/data" }, "loading": { "$state": "/orders/loading" }, "columns": [{ "field": "number", "label": "Order" }] }
    }
  }
}
```

- Every element has `type`, `props` and `children` (ids of other elements). Ids are unique within the page.
- Read state with `{ "$state": "/path" }`; two-way bind an input with `{ "$bindState": "/path" }`. Initial values go in the top-level `state`.
- Reads: a `Query` element loads on mount and when its props change, and writes `{ data, total, loading, error }` to its `resultPath`. Point display props at that path.
- Writes and effects: `on: { "<event>": { "action": "...", "params": { ... } } }`, or an array of steps. Use the actions the Catalog lists (`create`, `update`, `delete`, `invalidate`, `request`, `toast`, `notify`, `submitForm`…).
- Forms: save with `submitForm` (`resource`, `valuesPath`, optional `id`). It awaits business validation, keeps field errors and saves once. Do not chain a validation step and a `create` instead.
- JSON only: no functions, no expressions in strings, no component instances. If logic does not fit an action, it belongs in a registered action, not in the page.

## 3. Validate every page you changed

Validation uses the same Catalog as the app, so a valid page is one the app can render.

```sh
npx -y @duxweb/lumi-check@{{LUMI_VERSION}} src/pages/<page>.json --catalog src/catalog.mjs --json
```

`npm run check` does the same for the home page. Exit code 0 is valid, 1 is invalid, 2 is a file or catalog problem.

Each issue has a JSON path such as `/elements/orders/props/columns/0/kind`. Fix that spot and validate again until the result is valid. Do not report a page as finished while it fails, and do not "fix" an error by deleting the feature it belongs to.

## 4. Adding a component or action

Add the definition (zod props, slots, events, a one-line description) to `src/catalog.mjs` and its React implementation to the registry in `src/App.tsx`. The definition file stays free of React, because `lumi-check` loads it in Node. Then the new type is available to pages, to validation and to the lookup commands at once.

## 5. Look at it

Run the app (`npm run dev`) and open the page. Check the first load, an empty result, a failed request and, for forms, a rejected save. Validation proves the page is well formed, not that it does what was asked.
