# @duxweb/create-lumi

Create a React application using native json-render and Lumi UI:

```sh
pnpm create @duxweb/lumi my-app
cd my-app
pnpm dev
```

Options: --template react, --pm pnpm|npm|yarn, --no-install, --no-git, --no-ai (leaves out the Lumi skill). The scaffold uses final public entrypoints, pinned compatible dependencies and compiled CSS. No adapter selection is needed.

The small starter loads a local Spec or VITE_LUMI_SPEC_URL. Add @duxweb/lumi-admin when an Admin shell is needed. Isolated template checks pack the actual products, install outside the workspace, then typecheck and build the generated app.
