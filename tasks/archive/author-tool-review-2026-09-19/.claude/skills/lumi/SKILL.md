---
name: lumi
description: Build or review Lumi JSON pages, data services, UI and Admin features during the native json-render migration. Use for this repository's package boundaries, Catalog and Registry integration, or JSON-driven data and interactions.
---

# Lumi workflow

Read `AGENTS.md` and `plan/README.md` first. They distinguish current source packages from the final architecture and specify migration gates. Archive files contain history, not active instructions.

Use native json-render Spec, Catalog, Registry, StateStore, handlers, events, watchers and bindings. Lumi is an optional convenience and component/service layer; do not invent a private page syntax, renderer or registration API.

## Placement

- Neutral Lumi services/providers and Catalog definitions must not import frameworks. React hooks and integration belong in explicit /react entrypoints.
- UI owns visual components, tokens, and the native registry; it does not run queries or uploads. Admin React composes public UI React components, explicit routes and Shell behavior.
- DataProvider powers hooks and JSON handlers. Use resource/dataProviderName directly; do not introduce Resource registration or implicit CRUD routes.
- Current delivery is React. Remove the old Vue implementation according to the plan; future Vue binds the shared definitions to upstream json-render/vue and separate Vue components.

## Runtime behavior

Keep form/page editable values in one upstream StateStore. Preserve query consistency, auth invalidation, form dirty/draft/step behavior and overlay guards when moving code. Native watch reacts to changes; initial loading belongs to a registered query component or explicit loader.

Support cross-component interactions with shared state and registered handlers. JSON can request data and submit changes through configured services. Do not expose arbitrary component-ref calls or recreate the old command/scope/expression language.

## Validation

Use the actual assembled Catalog and installed upstream APIs. During migration old MCP/checker tools may still validate the legacy format; do not mistake that for native Spec acceptance. Verify native Providers/Renderer with Lumi registry as well as optional convenience setup. Preserve behavioral tests and replace retired protocol fixtures.

Keep generated docs derived from definitions, owned UI sources licensed, and raw Radix/shadcn/ReUI internals private. ReUI Pro content is prohibited. Follow the plan's package deletion and final validation gates.
