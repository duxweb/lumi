import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { applyLumiTheme } from '@duxweb/lumi-ui'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import theme from './theme.json'
import './style.css'
import '@duxweb/lumi-ui/style.css'

applyLumiTheme(themeConfigSchema.parse(theme))
createRoot(document.getElementById('root')!).render(<App />)
