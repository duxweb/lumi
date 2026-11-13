# Upstream source ledger

Snapshot date: 2026-08-10

## shadcn/ui

- Repository: `https://github.com/shadcn-ui/ui`
- Revision: `6261bd89f72d794aea491482cc2acfd8dc3d63e2`
- CLI and package runner: `pnpm dlx shadcn@4.16.2`
- Original upstream configuration: `style=radix-nova`, `base=radix`, Tailwind CSS v4, Lucide icons. The current local `components.json` uses `iconLibrary=hugeicons` so future registry updates follow the migrated icon system.
- Registry items: button, input, textarea, select, checkbox, radio-group, switch, dialog, drawer, card, tabs, alert, badge, table, pagination, field, calendar, popover, separator, spinner, breadcrumb, carousel, kbd, scroll-area, slider, toggle-group, empty
- Destination: `src/internal/shadcn/`
- Item-specific changes: `carousel` keeps the upstream component API and markup but replaces Embla with a native CSS scroll-snap track, so `embla-carousel-react` is not a dependency; `toggle-group` inlines its item styling instead of importing the upstream `toggle` item; `calendar` keeps day cells at a fixed `--cell-size` height (no `aspect-square` growth) with 2px between weeks and a 1px inset between day chips, leaves the month direction and the range band to `src/styles/calendar.css` (one tone per cell: chips on range ends, a lighter band only beside them), marks today with an outline instead of a fill, shows the focus ring for keyboard focus only, memoizes its custom components so re-renders do not remount the grids, and adds a default `captionLayout="panel"` that registers the Lumi-authored month/year panel (`src/internal/calendar-panel.tsx`) as its `Months` and `MonthCaption` components; `empty` keeps the upstream parts and slots but drops the viewport-based padding and fixed gaps (the `LumiEmpty` size sets them), merges `EmptyMedia` classes through `cn`, gives `EmptyDescription` the `div` props it renders, and reads the title, description, radius and icon tint from Lumi type, radius and colour tokens.
- Original files: Lumi-authored internal modules that use Radix directly but have no upstream counterpart (for example `src/internal/data-table/` and `src/internal/choice-card.tsx`) live outside `src/internal/shadcn/` and `src/internal/reui/`, so the manifest only lists real derivatives.
- Base stylesheet: the `radix-nova` style imports `shadcn/tailwind.css`. Lumi does not take that package as a dependency; the state variants its components require (`data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal`, `data-vertical`) are copied verbatim into `src/style.css`. The unused utilities of that file (`scroll-fade`, `shimmer`, `no-scrollbar`) are not copied.
- Local changes: imports target package-private aliases; upstream icon imports are projected through the package-owned Hugeicons Stroke Rounded wrapper at `src/icons.tsx`; Lumi-neutral props, event conversion, controlled/uncontrolled behavior, Form errors, upload orchestration, and contract registration live separately in `src/components/`. No raw internal component is exported from the package entry.

The machine-readable source-to-destination inventory, including separate upstream and owned-source SHA-256 values, is `upstream-manifest.json`. `pnpm verify:upstream:offline` requires the exact independently controlled repository, revision, item, immutable path, destination, license, and hash inventory without network access. The CI/release `pnpm verify:upstream` gate runs that offline verification and then fetches every fixed-commit source to verify its recorded upstream SHA-256; any network or hash failure blocks the gate.

## Radix Primitives

- Repository: `https://github.com/radix-ui/primitives`
- Revision observed when the snapshot was created: `f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae`
- Consumption: runtime dependency through the official unified `radix-ui` package; no Radix source file is copied into this repository.

## ReUI

- Repository: `https://github.com/keenthemes/reui`
- Revision: `020858ed0cd76713fd7f1c38579b5239a9674f7b` (`v2.0.1`)
- Registry snapshots inspected: `public/r/styles/radix-nova/frame.json`, `filters.json`, `stepper.json`, and `timeline.json`.
- Public source items: `registry-reui/bases/radix/reui/frame.tsx`, `filters.tsx`, `stepper.tsx`, and `timeline.tsx`.
- Destinations: `src/internal/reui/frame.tsx`, `filters.tsx`, `stepper.tsx`, and `timeline.tsx`.
- Local changes: reduced each item to the structure and keyboard behavior used by Lumi; removed upstream aliases, style-specific private variables, shadows, `IconPlaceholder`, unused menus, examples, i18n helpers, and dependencies. Lumi-neutral props, raw event conversion, controlled/uncontrolled state, loading/empty behavior, and accessibility labels live only in `src/components/extensions.tsx`.
- Excluded: Data Grid was inspected at the fixed revision but not copied because the current neutral `Table` does not need its additional TanStack/virtualization machinery. Kanban (`registry-reui/bases/radix/reui/kanban.tsx`) was inspected at the fixed revision as an API reference only; no code was copied, and the Admin Kanban is an original implementation. No ReUI Pro, pattern, preview, screenshot, image, icon, or site-example asset was accessed or included.
- License: ReUI MIT; see `LICENSES/reui-MIT.txt`.

## Manual upgrade procedure

1. Run `pnpm upstream:dry-run`. It pins shadcn 4.16.2, asks its CLI to preview registry changes, and downloads all 32 fixed-commit public sources into a temporary directory. Every download must match its recorded upstream SHA-256. It does not write owned files.
2. Run `pnpm upstream:diff`. It asks the same pinned CLI for diffs, then fetches the same fixed-commit sources into a temporary directory and runs `git diff --no-index` against each owned derivative.
3. Inspect only those fixed public source diffs. Never access ReUI Pro, site previews, examples, screenshots, images, icons, or templates.
4. Merge selected changes manually into `src/internal/`, update `upstream-manifest.json` revisions and hashes, then run `pnpm verify:upstream:offline` from the repository root.
5. Run the UI wrapper/unit tests, the 30-page visual matrix, and the complete axe matrix before accepting the upgrade.

The dry-run and diff commands intentionally omit `--overwrite`; owned sources are never replaced automatically.
