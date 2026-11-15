import type { Spec } from '@json-render/core'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { LumiActivityFeed } from '../src/components/activity-feed.js'
import { LumiTimeline } from '../src/components/extensions.js'
import { uiRegistry } from '../src/react/index.js'

const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('lumiActivityFeed', () => {
  const items = [
    { key: 'a1', actor: 'Mina Manager', action: 'approved', target: 'Atlas budget', context: 'Atlas rollout', status: { label: 'Approved', tone: 'success' as const }, timestamp: '10 min ago', dateTime: '2026-08-10T07:20:00Z' },
    { key: 'a2', actor: 'Theo Ops', action: 'commented on', target: 'Access audit', timestamp: 'Yesterday' },
  ]

  it('is a strict catalog entry', () => {
    expect(uiComponentDefinitions.ActivityFeed.props.safeParse({ items }).success).toBe(true)
    expect(uiComponentDefinitions.ActivityFeed.props.safeParse({ items: [{ key: 'a', actor: 'A' }] }).success).toBe(false)
    expect(uiComponentDefinitions.ActivityFeed.props.safeParse({ items: [{ ...items[1], href: '/elsewhere' }] }).success).toBe(false)
  })

  it('reads actor, action and target as one sentence with the time on the first line', () => {
    const html = renderToStaticMarkup(<LumiActivityFeed ariaLabel="Recent activity" items={items} />)
    expect(html).toContain('<ol aria-label="Recent activity" data-slot="activity-feed"')
    expect(html).toContain('<strong data-slot="activity-feed-actor">Mina Manager</strong> approved <strong data-slot="activity-feed-target">Atlas budget</strong>')
    expect(html).toContain('<time data-slot="activity-feed-time" dateTime="2026-08-10T07:20:00Z"')
    expect(html).toContain('Atlas rollout')
    expect(html).toContain('data-tone="success"')
    // The avatar repeats the actor's name, so only the sentence speaks it.
    expect(html).toMatch(/<span aria-hidden="true" class="flex row-span-2"><span class="inline-flex"><span role="img" aria-label="Mina Manager"/)
    // The status sits under the time, so badges line up in one column.
    expect(html).toMatch(/<span data-slot="activity-feed-status" class="col-start-3 row-start-2[^"]*"><span[^>]*data-tone="success"/)
    // Rows do not navigate, so nothing in them is a link or a button.
    expect(html).not.toMatch(/<a |<button/)
  })

  it('keeps the word order of a phrase that places the names itself', () => {
    const html = renderToStaticMarkup(<LumiActivityFeed items={[{ key: 'a', actor: 'Agent', action: '{actor} 为 {target} 起草了跟进', target: '3 笔超时订单' }]} />)
    expect(html).toContain('<strong data-slot="activity-feed-actor">Agent</strong> 为 <strong data-slot="activity-feed-target">3 笔超时订单</strong> 起草了跟进')
  })

  it('shows a placeholder while loading and says so when empty', () => {
    expect(renderToStaticMarkup(<LumiActivityFeed items={[]} loading />)).toContain('Loading activity')
    expect(renderToStaticMarkup(<LumiActivityFeed items={[]} />)).toContain('No activity yet')
    expect(renderToStaticMarkup(<LumiActivityFeed items={[]} empty="Quiet day" />)).toContain('Quiet day')
  })

  it('renders from a native Spec through the UI registry', () => {
    const spec: Spec = { root: 'feed', elements: { feed: { type: 'ActivityFeed', props: { ariaLabel: 'Team', items }, children: [] } } }
    const html = renderToStaticMarkup(<JSONUIProvider registry={uiRegistry}><Renderer spec={spec} registry={uiRegistry} /></JSONUIProvider>)
    expect(html).toContain('data-slot="activity-feed"')
    expect(html).toContain('Theo Ops')
  })
})

describe('lumiTimeline date placement', () => {
  const items = [{ key: 'kickoff', title: 'Kick-off', description: 'Scope agreed.', timestamp: 'Jul 08', status: 'complete' as const }]

  it('puts the time at the end of the title line unless told to stack it', () => {
    expect(uiComponentDefinitions.Timeline.props.safeParse({ items, datePlacement: 'below' }).success).toBe(true)
    expect(uiComponentDefinitions.Timeline.props.safeParse({ items, datePlacement: 'start' }).success).toBe(false)
    expect(renderToStaticMarkup(<LumiTimeline items={items} />)).toContain('data-date-placement="end"')
    expect(renderToStaticMarkup(<LumiTimeline items={items} datePlacement="below" />)).toContain('data-date-placement="below"')
    expect(rule('[data-slot="timeline-header"]')).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(rule('[data-slot="timeline"][data-date-placement="below"] [data-slot="timeline-header"]')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(rule('[data-slot="timeline-date"]')).toContain('font-variant-numeric: tabular-nums')
  })

  it('threads one rule from marker centre to marker centre under the markers', () => {
    const separator = rule('[data-slot="timeline-separator"]')
    expect(separator).toContain('top: calc(var(--lumi-ui-timeline-line) / 2)')
    expect(separator).toContain('bottom: calc(var(--lumi-ui-timeline-line) / -2)')
    expect(rule('[data-slot="timeline-indicator"]')).toContain('z-index: 1')
    expect(rule('[data-slot="timeline-item"][data-state="current"] [data-slot="timeline-indicator"]')).toMatch(/inset 0 0 0 2px var\(--brand\), 0 0 0 3px/)
    expect(rule('[data-slot="timeline-item"][data-state="upcoming"] [data-slot="timeline-indicator"]')).toContain('background: var(--lumi-ui-timeline-surface)')
  })
})
