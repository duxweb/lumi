# Implementation Plan: Hugeicons Outline Migration

## Overview

Replace the React delivery stack's Lucide runtime dependency with the official MIT Hugeicons renderer and free Stroke Rounded icon pack. Preserve Lumi's neutral manifest icon names while changing only the concrete React icon implementation.

## Architecture Decisions

- Keep manifest icon strings neutral and backward-compatible; `ShellIcon` maps them to Hugeicons data.
- Use `@hugeicons/react` with `@hugeicons/core-free-icons` and a shared `strokeWidth` of `1.5`.
- Migrate owned shadcn/ReUI sources locally instead of modifying upstream behavior or introducing Pro assets.
- Remove Lucide from package manifests, templates, generated references, and release checks only after all runtime imports are gone.

## Task List

### Phase 1: Dependencies and shared renderer

- [x] Add Hugeicons packages to the pnpm catalog and React delivery packages.
- [x] Add package-owned Hugeicons wrappers for consistent outline rendering.

### Checkpoint: Foundation

- [x] Target packages typecheck with both packages installed.

### Phase 2: Runtime migration

- [x] Migrate Admin Shell and page-state icons.
- [x] Migrate UI Adapter controls, data display, extensions, and owned shadcn internals.
- [x] Replace legacy icon-prefix references in maintained React code and preserve Vue headless boundaries.

### Checkpoint: Runtime

- [x] Admin and UI Adapter tests pass; visual smoke shows outline icons.

### Phase 3: Removal and release hygiene

- [x] Remove Lucide dependencies and update scaffolding/release checks.
- [x] Update third-party notices and icon documentation.

### Checkpoint: Complete

- [x] Repository has no active `lucide-react` imports or dependencies.
- [x] Typecheck, tests, build, E2E smoke, and Axe pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Hugeicons names do not match Lucide names | Missing icons | Keep Lumi's string catalog and map every name explicitly with a tested fallback. |
| Owned shadcn updates reintroduce Lucide | Drift | Update upstream verification metadata/docs and add a no-Lucide regression check. |
| Free pack is Stroke Rounded rather than Pro outline variants | Visual mismatch | Use the free Stroke Rounded set consistently at `1.5` stroke width; do not use Pro assets. |

## Open Questions

- None. The requested "outline" direction maps to the free Stroke Rounded set.
