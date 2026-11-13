import type { Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import { LumiSpecPage } from '@duxweb/lumi'
import { adminCatalog, adminRegistry } from '@duxweb/lumi-admin'
import { createAdminI18nProvider } from '@duxweb/lumi-admin/catalog'
import { LumiUiTextProvider } from '@duxweb/lumi-ui'
import { demoContext } from '../demo/context'
import '@duxweb/lumi-admin/style.css'

// Outside the Shell, UI and Admin components take their strings from the
// same i18n the Shell wraps, so the docs preview reads like the demo.
const context = demoContext('zh')
const i18n = createAdminI18nProvider(context.i18nProvider)
const translate = i18n.translate.bind(i18n)

/** A component example from the gallery, rendered with the real registry. */
export function DocPreview({ spec }: { spec: Spec }): ReactElement {
  return (
    <LumiUiTextProvider translate={translate} locale={i18n.getLocale()}>
      <LumiSpecPage context={context} catalog={adminCatalog} registry={adminRegistry} spec={spec} agent={false} />
    </LumiUiTextProvider>
  )
}
