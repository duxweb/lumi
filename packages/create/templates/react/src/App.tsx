import type { Spec } from '@json-render/core'
import { createLumi, createSimpleDataProvider, LumiSpecPage, lumiRegistry } from '@duxweb/lumi'
import { uiRegistry } from '@duxweb/lumi-ui'
import { catalog } from './catalog.mjs'
import home from './pages/home.json'

const context = createLumi({ dataProvider: createSimpleDataProvider({ apiUrl: '/api' }) })
const registry = { ...uiRegistry, ...lumiRegistry }
const specUrl = import.meta.env.VITE_LUMI_SPEC_URL

export function App() {
  return <main className="app-page"><div className="app-shell">
    <LumiSpecPage context={context} catalog={catalog} registry={registry} spec={specUrl ? undefined : home as Spec} src={specUrl || undefined} />
  </div></main>
}
