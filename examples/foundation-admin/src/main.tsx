import { createLumi, createSimpleDataProvider } from '@duxweb/lumi'
import { adminRegistry, createAdmin } from '@duxweb/lumi-admin'
import { defineRegistry } from '@json-render/react'
import { createRoot } from 'react-dom/client'
import { catalog, extensionCatalog } from './catalog'
import { WorkflowDesigner } from './WorkflowDesigner'
import '@duxweb/lumi-ui/style.css'
import '@duxweb/lumi-admin/style.css'
import './style.css'

const { registry: extensions } = defineRegistry(extensionCatalog, { components: {
  WorkflowDesigner: ({ props }) => <WorkflowDesigner {...props} />,
} })
const base = import.meta.env.BASE_URL
const admin = createAdmin({
  context: createLumi({ dataProvider: createSimpleDataProvider({ apiUrl: '/api' }) }),
  catalog,
  registry: { ...adminRegistry, ...extensions },
  manifest: `${base}manifest.json`,
  theme: `${base}theme.json`,
})

createRoot(document.getElementById('app')!).render(<admin.App />)
