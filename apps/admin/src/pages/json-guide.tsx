import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { useTranslate } from '@duxweb/lumi'
import { adminRegistry } from '@duxweb/lumi-admin'
import { uiRegistry } from '@duxweb/lumi-ui'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { DeveloperPage, SpecExample, StateView } from '../developer/kit.js'
import { ADMIN_BASE_CONFIG, json } from '../developer/source.js'
import { actionSpecs, querySpecs, startSpecs, stateSpecs } from '../json-specs.js'

// The JSON rendering guide: every example is a native Spec rendered live
// beside its source. Text sits in the Spec as `$t` and is shown resolved.

const NATIVE_HOST: CodeFile = {
  name: 'App.tsx',
  language: 'tsx',
  code: `import { uiRegistry } from '@duxweb/lumi-ui'
import { JSONUIProvider, Renderer } from '@json-render/react'
import spec from './page.json'
import '@duxweb/lumi-ui/style.css'

export function App() {
  return (
    <JSONUIProvider registry={uiRegistry} initialState={spec.state}>
      <Renderer spec={spec} registry={uiRegistry} />
    </JSONUIProvider>
  )
}`,
}

const SERVICES_HOST: CodeFile = {
  name: 'App.tsx',
  language: 'tsx',
  code: `import { createLumi, LumiProvider, lumiRegistry, createSimpleDataProvider } from '@duxweb/lumi'
import { uiRegistry } from '@duxweb/lumi-ui'
import { Renderer } from '@json-render/react'
import spec from './products.json'

const lumi = createLumi({
  dataProvider: createSimpleDataProvider({ apiUrl: 'https://api.example.com' }),
})
const registry = { ...uiRegistry, ...lumiRegistry }

export function App() {
  return (
    <LumiProvider context={lumi} registry={registry} initialState={spec.state}>
      <Renderer spec={spec} registry={registry} />
    </LumiProvider>
  )
}`,
}

const ADMIN_HOST: readonly CodeFile[] = [
  {
    name: 'index.html',
    language: 'html',
    code: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@duxweb/lumi-admin/dist/base/lumi-admin.css" />
<script type="module"
  src="https://cdn.jsdelivr.net/npm/@duxweb/lumi-admin/dist/base/lumi-admin.js"
  data-config="/admin/config.json"></script>
<div id="app"></div>`,
  },
  { name: 'config.json', language: 'json', code: json(ADMIN_BASE_CONFIG) },
]

export function AdminJsonStartRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Getting started')} description={t('A page is a native json-render Spec, rendered with the upstream Renderer')}>
      <SpecExample
        title={t('Spec structure')}
        spec={startSpecs.structure}
      />
      <SpecExample
        title={t('Render with json-render alone')}
        spec={startSpecs.structure}
        before={[NATIVE_HOST]}
        render={(spec, revision) => (
          <JSONUIProvider key={revision} registry={uiRegistry} initialState={spec.state}>
            <Renderer spec={spec} registry={uiRegistry} />
            <StateView />
          </JSONUIProvider>
        )}
      />
      <SpecExample
        title={t('Add Lumi data services')}
        spec={startSpecs.services}
        fileName="products.json"
        before={[SERVICES_HOST]}
        layout="stack"
      />
      <SpecExample
        title={t('Localized text with $t')}
        spec={startSpecs.i18n}
        raw
      />
      <SpecExample
        title={t('A route in the Admin preset')}
        spec={startSpecs.admin}
        fileName="pages/fulfilment.json"
        before={ADMIN_HOST}
        registry={adminRegistry}
        layout="stack"
      />
    </DeveloperPage>
  )
}

export function AdminJsonStateRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('State binding')} description={t('Values live in the page StateStore: props read them, controls write back')}>
      <SpecExample
        title={t('$state and $bindState')}
        spec={stateSpecs.bind}
      />
      <SpecExample
        title={t('Conditional visibility')}
        spec={stateSpecs.visible}
      />
      <SpecExample
        title={t('$cond and $template')}

        spec={stateSpecs.cond}
      />
      <SpecExample
        title={t('Lists with repeat')}
        spec={stateSpecs.repeat}
      />
      <SpecExample
        title={t('watch for dependent fields')}
        spec={stateSpecs.watch}
      />
    </DeveloperPage>
  )
}

export function AdminJsonActionsRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Actions & requests')} description={t('Events call registered actions: json-render\'s own and Lumi\'s data, feedback and form actions')}>
      <SpecExample
        title={t('setState')}
        spec={actionSpecs.setState}
      />
      <SpecExample
        title={t('pushState and removeState')}
        spec={actionSpecs.arrays}
      />
      <SpecExample
        title={t('toast and notify')}
        spec={actionSpecs.feedback}
        align="center"
        showState={false}
      />
      <SpecExample
        title={t('request')}
        spec={actionSpecs.request}
      />
      <SpecExample
        title={t('delete and invalidate')}
        spec={actionSpecs.mutations}
        showState={false}
      />
      <SpecExample
        title={t('submitForm')}
        spec={actionSpecs.submit}
      />
    </DeveloperPage>
  )
}

export function AdminJsonQueryRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Data queries')} description={t('Query reads through the DataProvider and writes the result to state')}>
      <SpecExample
        title={t('A filtered list')}
        spec={querySpecs.list}
        showState={false}
      />
      <SpecExample
        title={t('Pages and sorting')}
        spec={querySpecs.pages}
        showState={false}
      />
      <SpecExample
        title={t('Master and detail')}
        spec={querySpecs.detail}
        showState={false}
      />
      <SpecExample
        title={t('A list with its totals')}
        spec={querySpecs.aggregate}
        showState={false}
      />
    </DeveloperPage>
  )
}
