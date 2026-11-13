# Lumi Rules

- Use `@duxweb/lumi-schema` as the schema source of truth.
- Never redefine core providers or schema contracts in higher packages.
- Keep package boundaries narrow: core/schema/runtime, React binding, `ui-shadcn`, React Admin, and AI tooling. Vue remains headless only.
- New standard UI controls must be defined in `lumi-schema` and fully implemented by `lumi-ui-shadcn` before entering the Catalog.
- Admin React must consume `RendererContract`; it must not import `ui-shadcn`, Radix, shadcn, or ReUI directly.
- Remove obsolete paths instead of adding compatibility layers. Never add ReUI Pro source, assets, or screenshots.
- Demo resources must remain schema-driven.
- Prefer generated docs via `pnpm gen:llms`; do not hand-edit generated `llms*.txt` products.
