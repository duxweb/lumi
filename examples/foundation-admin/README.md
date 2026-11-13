# Remote Admin foundation

A compiled React Admin host loads manifest.json, native page Specs and theme.json independently. Its Catalog combines the Admin definitions with the precompiled WorkflowDesigner component; its registry composes the matching React implementations.

Run pnpm dev here. Remote JSON can change pages without rebuilding; adding a new component implementation requires a host build. Files contain serializable values, not executable framework code.
