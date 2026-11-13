# Lumi Rules

- Read `plan/README.md` for the current target and deletion gates; historical plans are not instructions.
- Use native json-render syntax and APIs. Lumi supplies default services, Catalog definitions, registries, handlers and optional setup.
- Final product packages are lumi, lumi-ui and lumi-admin; tools are lumi-check, lumi-mcp and create-lumi.
- Neutral roots and Catalog definitions contain no React/Vue/DOM dependencies. React implementations use explicit /react entrypoints; future Vue uses the upstream Vue renderer.
- UI does not execute data requests; Admin React uses public UI React components; raw UI internals remain private.
- DataProvider and query services power both hooks and JSON actions. Use one StateStore for editable page/form values.
- Remove the legacy protocol, RendererContract, custom expression engine and old Vue binding as consumers migrate; do not keep compatibility layers.
- Preserve business behavior, themes, responsive UI and accessibility. ReUI Pro content is prohibited.
- Generate documentation and CLI/MCP validation from actual native Catalog definitions. Do not hand-edit generated LLM/API products.
