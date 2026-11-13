# Third-party notices

This package contains locally owned source files generated from the official shadcn/ui registry. shadcn/ui is Copyright (c) 2023 shadcn and licensed under the MIT License; see `LICENSES/shadcn-ui-MIT.txt`.

The generated components use the `radix-ui` package at runtime. Radix Primitives is Copyright (c) 2022 WorkOS and licensed under the MIT License; see `LICENSES/radix-primitives-MIT.txt`.

This package also contains reduced source derivatives of the public ReUI Radix components Frame, Filters, Stepper, and Timeline from the fixed revision recorded in `UPSTREAM_SOURCES.md`. ReUI is Copyright (c) 2025 Keenthemes Inc and licensed under the MIT License; see `LICENSES/reui-MIT.txt`.

The concrete icon renderer and free Stroke Rounded icon data come from `@hugeicons/react` and `@hugeicons/core-free-icons`. Hugeicons is Copyright (c) 2025 Hugeicons and licensed under the MIT License; see `LICENSES/hugeicons-MIT.txt`. No Hugeicons Pro package or asset is included.

Additional runtime dependencies retain their own licenses and copyright notices: Vaul (MIT), React DayPicker (MIT), date-fns (MIT), class-variance-authority (Apache-2.0), clsx (MIT), tailwind-merge (MIT), Tailwind CSS (MIT), and tw-animate-css (MIT).

See `UPSTREAM_SOURCES.md` for exact source revisions, registry items, and local modifications.
## Optional chart engine

The optional charts entry uses **VChart 2.1.2** (`@visactor/vchart`), published by VisActor under the MIT license. It is an optional peer dependency, not copied source. See [upstream repository and license](https://github.com/VisActor/VChart/tree/v2.1.2). Its chart types, axes, and canvas tooltip handler are registered on demand; no native VChart API is exposed through Lumi's neutral contract.
