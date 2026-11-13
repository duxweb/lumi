import { defineLumiPackage } from '../../config/tsdown.base.ts'

export default defineLumiPackage({ entry: { 'index': 'src/index.ts', 'catalog': 'src/catalog.ts', 'validation-json-schema': 'src/validation-json-schema.ts' }, sourcemap: true })
