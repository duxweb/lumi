# code-style

Use this skill for Lumi TypeScript, package, and documentation style.

## Source Style

- ESM only.
- Strict TypeScript.
- Use `import type` and `export type` for type-only symbols.
- Source comments are English only.
- Keep files small and package responsibilities narrow.
- Prefer structured APIs and existing local helpers over ad hoc parsing.

## Package Style

- Package entrypoint is `src/index.ts`.
- Versions come from the pnpm catalog using `catalog:`.
- Shared singletons go in `peerDependencies` and `devDependencies`.
- Tooling-only dependencies may go in root `devDependencies`; runtime CLI/server dependencies may go in package `dependencies`.

## Verification

Run the full gate after completed items:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

For generated LLM docs, run:

```bash
pnpm gen:llms
```
