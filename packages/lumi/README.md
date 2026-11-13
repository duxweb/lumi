# @duxweb/lumi

Services and native json-render integration for React. The `@duxweb/lumi` root exports DataProvider contracts, authentication, business validation, request handlers, Spec loaders, React hooks and the optional LumiProvider/LumiSpecPage. `@duxweb/lumi/catalog` is the framework-free subset (component/action definitions, `validateDocument`, `validateConfig`, Spec loaders, `composeDefinitions`) for Node tools and server-side validation without React.

Use upstream Spec, Catalog, Registry, StateStore, bindings, on and watch directly. Definitions are exported from `/catalog`; the host assembles its Catalog with the upstream platform schema. Lumi never translates another page protocol.

Query connects initial/parameter-driven reads to one result path. request/create/update/delete/invalidate/submitForm/login/logout handlers use the same services as hooks. Forms keep editable values in the native Store, await business validation, prevent duplicate saves and preserve structured field errors. `FormValidationError` is the shared error shape for custom providers. Optional JSON Schema business validation lives under `/validation-json-schema`.

Configure data/auth/upload providers only when those capabilities are used. Lumi does not import UI or Admin. See the repository guide and native integration tests for full examples.
