import { defineLumiPackage } from '../../config/tsdown.base.ts'

export default defineLumiPackage({
  entry: { index: 'src/index.ts', catalog: 'src/catalog.ts', charts: 'src/charts.tsx' },
  sourcemap: true,
  outputOptions: {
    // The editor chunk imports the highlighter statically, and each editor
    // language chunk imports its grammar chunk statically, so their dynamic
    // imports get re-export facades. A `code-` prefix keeps the size budget's
    // `highlight-*`, `grammar-*` and `language-*` patterns on the one chunk
    // that holds each piece of code.
    chunkFileNames: chunk => chunk.isDynamicEntry && chunk.facadeModuleId?.includes('/src/code/') && !chunk.moduleIds.includes(chunk.facadeModuleId) ? 'code-[name]-[hash].js' : '[name]-[hash].js',
  },
})
