# @duxweb/lumi-check

TypeScript CLI and library for authoring native Specs against the same application Catalog as runtime: look up what the Catalog offers, then validate what was written.

```sh
# Validate
lumi-check page.json --catalog ./catalog.mjs --json
lumi-check manifest.json --kind manifest
lumi-check theme.json --kind theme
lumi-check config.json --kind config
cat page.json | lumi-check - --json

# Look up
lumi-check catalog --catalog ./catalog.mjs
lumi-check catalog --kind actions --name submitForm
lumi-check describe Table --catalog ./catalog.mjs
```

Validation exit codes: 0 valid, 1 invalid, 2 I/O/configuration error. `catalog` prints the components and actions as JSON, an action asked for by `--name` with its params as JSON Schema, and exits 1 when the name matches nothing. `describe` prints one component's props as JSON Schema with its slots and events, and exits 2 for an unknown component. The library exports the same lookups as `getCatalog` and `describeComponent`.

The default catalog is the Lumi Admin preset. A trusted local ESM module exports catalog (or default), and optionally directives. Custom components/actions therefore have identical lookup and validation in the app and the CLI.

The build includes upstream's framework-free React schema so author tools do not require installing React. It does not bundle or execute the renderer. Business form validation remains a separate Lumi Validator capability.
