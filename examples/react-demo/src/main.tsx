import { applyLumiTheme, uiRegistry } from '@duxweb/lumi-ui'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { createRoot } from 'react-dom/client'
import theme from '../theme.json'
import { DEMO_SPEC } from './schema'
import './style.css'

applyLumiTheme({ ...theme, mode: 'light', radius: 'lg' })
createRoot(document.getElementById('root')!).render(
  <JSONUIProvider registry={uiRegistry} initialState={DEMO_SPEC.state}>
    <main className="demo-page"><div className="demo-shell"><Renderer spec={DEMO_SPEC} registry={uiRegistry} /></div></main>
  </JSONUIProvider>,
)
