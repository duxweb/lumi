import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { LumiAvatarGroup } from '@duxweb/lumi-ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LumiDashboardCard } from '../src/react/pages/LumiDashboardCard.js'
import { LumiProportionList } from '../src/react/pages/LumiProportionList.js'

describe('team load card', () => {
  const items = [
    { key: 'mina', label: 'Mina Manager', value: 9, display: '9 tasks', tone: 'warning' as const },
    { key: 'ada', label: 'Ada Admin', value: 6, display: '6 tasks' },
  ]

  it('sets the reading back as a muted count only when asked', () => {
    expect(adminCatalogDefinitions.components.ProportionList.props.safeParse({ ariaLabel: 'Load', items, valueTone: 'muted' }).success).toBe(true)
    expect(adminCatalogDefinitions.components.ProportionList.props.safeParse({ ariaLabel: 'Load', items, valueTone: 'loud' }).success).toBe(false)
    expect(renderToStaticMarkup(<LumiProportionList ariaLabel="Load" items={items} valueTone="muted" />)).toContain('data-value-tone="muted"')
    const plain = renderToStaticMarkup(<LumiProportionList ariaLabel="Load" items={items} />)
    expect(plain).not.toContain('data-value-tone')
    expect(plain).toContain('data-tone="warning"')
  })

  it('carries the team in the header slot, beside the title and description', () => {
    const html = renderToStaticMarkup(
      <LumiDashboardCard title="Team load" description="Open tasks per person" action={<LumiAvatarGroup label="Team" size="sm" max={3} items={[{ name: 'Ada Admin' }, { name: 'Mina Manager' }, { name: 'Sam Support' }, { name: 'Li Wei' }]} />}>
        <LumiProportionList ariaLabel="Load" items={items} valueTone="muted" />
      </LumiDashboardCard>,
    )
    const header = html.slice(html.indexOf('data-slot="card-header"'), html.indexOf('data-slot="card-content"'))
    expect(header).toContain('data-slot="card-action"')
    expect(header).toContain('aria-label="Team"')
    expect(html).not.toContain('lumi-dashboard-card__footer')
  })
})
