import type { Plugin } from 'vite'

const VCHART_SHADOW_ROOT_STUB = '\0vchart-shadow-root-stub'

export function vchartBuildBundle(): Plugin {
  return {
    name: 'lumi:vchart-build-bundle',
    apply: 'build',
    config() {
      return {
        resolve: {
          alias: { '@visactor/vchart': '@visactor/vchart/build/index.min.js' },
        },
      }
    },
    resolveId(source, importer) {
      if (source === './shadow-root' && importer?.includes('@visactor/vchart/build'))
        return VCHART_SHADOW_ROOT_STUB
      return undefined
    },
    load(id) {
      if (id === VCHART_SHADOW_ROOT_STUB)
        return 'export function createShadowRoot() { return null }'
      return undefined
    },
  }
}
