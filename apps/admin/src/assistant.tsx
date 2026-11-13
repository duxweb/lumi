import type { ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { useShell } from '@duxweb/lumi-admin'
import { LumiButton as Button, LumiCard as Card } from '@duxweb/lumi-ui'
import { capabilityCoverage } from './capabilities.js'

/** Sidebar footer: showcase coverage derived from the capability list. */
export function DemoCoverageCard(): ReactElement {
  const shell = useShell()
  const t = useTranslate()
  const { complete, align, planned, total } = capabilityCoverage()
  return (
    <Card data-testid="demo-coverage" aria-label={t('Showcase coverage')} title={t('Coverage {complete}/{total}', { complete, total })} description={t('{align} need alignment · {planned} planned', { align, planned })}>
      <Button size="sm" appearance="outline" label={t('View overview')} onClick={() => shell.navigation.navigate('/')} />
    </Card>
  )
}
