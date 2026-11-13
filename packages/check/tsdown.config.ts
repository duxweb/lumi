import { defineLumiPackage } from '../../config/tsdown.base.ts'

// Bundle only upstream's framework-free schema so the CLI does not install React.
export default defineLumiPackage({
  entry: ['src/index.ts', 'src/cli.ts'],
  external: (id: string) => id !== '@json-render/react/schema' && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
})
