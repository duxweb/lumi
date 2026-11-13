import type { LumiContext } from '@duxweb/lumi'
import type { Locale } from '../i18n'
import { createI18nProvider, createLumi } from '@duxweb/lumi'
import { notifier, toaster } from '@duxweb/lumi-ui'
import zhCN from '../../../admin/public/locales/zh-CN.json'
import { COPY } from '../i18n'
import { demoAccessProvider, demoAuthProvider, demoDataProvider } from './data'

const contexts = new Map<Locale, LumiContext>()

/** One Lumi context per language; the demo admin reads its data and messages from it. */
export function demoContext(locale: Locale): LumiContext {
  const existing = contexts.get(locale)
  if (existing)
    return existing
  const context = createLumi({
    dataProvider: demoDataProvider,
    authProvider: demoAuthProvider,
    accessProvider: demoAccessProvider,
    toastProvider: toaster,
    notificationProvider: notifier,
    i18nProvider: createI18nProvider({ locale: COPY[locale].demo.locale, fallbackLocale: 'en-US', translations: { 'zh-CN': zhCN } }),
  })
  contexts.set(locale, context)
  return context
}
