# {{PROJECT_NAME}}

Native json-render Spec with Lumi services and owned Lumi UI.

```sh
{{PM}} install
{{PM}} dev
```

Pages are JSON under src/pages; src/App.tsx renders them with LumiSpecPage. src/catalog.mjs is the one Catalog that the app and `npm run check` (lumi-check) both read. Set VITE_LUMI_SPEC_URL to load a remote Spec validated against the same Catalog. src/main.tsx applies src/theme.json. Compiled UI CSS is included; no Tailwind setup is needed.

For a complete Admin shell, add @duxweb/lumi-admin and explicitly configure a manifest and providers.

## Writing pages with AI

The project ships a Lumi skill (`.claude/skills/lumi`, `.agents/skills/lumi`). An agent looks up components with `lumi-check catalog` and `lumi-check describe`, writes the page JSON and validates it with `lumi-check` before calling it done, all against src/catalog.mjs. Create the project with `--no-ai` to leave the skill out.
