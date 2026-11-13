import type { ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { LumiEmptyState, LumiPage, LumiPageHeader } from '@duxweb/lumi-admin'
import { useLocation, useNavigate } from 'react-router'
import { CAPABILITIES } from '../capabilities.js'

// Composed only from public Lumi UI / Admin components: any visual gap on this
// page is a component gap, not something to patch with demo CSS.

export function AdminPlannedRoute(): ReactElement {
  const t = useTranslate()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const item = CAPABILITIES.find(entry => entry.path === pathname)
  return (
    <LumiPage stack>
      <LumiPageHeader title={item?.label ? t(`demo.${item.label}`, undefined, item.label) : t('Planned capability')} description={item?.summary} />
      <LumiEmptyState
        kind="empty"
        title={t('Planned')}
        reason={t('Not built yet. Layers: {layers}', { layers: item?.layers.join(', ') ?? '—' })}
        nextStep={item?.plan?.join(' · ') ?? t('Not scheduled yet')}
        actionLabel={t('Back to the dashboard')}
        onAction={() => navigate('/')}
      />
    </LumiPage>
  )
}
