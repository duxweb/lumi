# Lumi Agent Guide

Read the root `AGENTS.md` and `plan/README.md`. The plan is the sole architecture and migration source; `tasks/archive/` is historical evidence only.

Lumi enhances native json-render with services, UI, and Admin. Keep upstream Spec/Catalog/Registry/StateStore/handlers and native extension APIs. Current delivery is React; neutral roots and Catalog definitions must remain free of framework imports for future Vue support.

Follow the package migration table and phase gates. The current old packages are source material, not the target architecture. Preserve useful data/form/auth/upload/Shell behavior and all user changes. Remove old Vue and RendererContract after consumers migrate; do not add a compatibility engine.

UI owns visuals and native component registration. Lumi owns request/data services and JSON handlers. Admin composes public UI and explicit routes. JSON must be able to load data, mutate it and trigger component interactions through native state/actions.

Use actual Catalog definitions and current tools; do not assume the old MCP/checker already accepts the new Spec. Run appropriate tests and builds, then the final gates defined in the plan. Keep English source comments, ESM/type-only imports, semantic tokens, licensed public sources and Changesets releases.
