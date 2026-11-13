import type { TimelineProps, Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useToast, useTranslate } from '@duxweb/lumi'
import { LumiDashboardCard, LumiDashboardPage, LumiRecordList, LumiSegmented } from '@duxweb/lumi-admin'
import { LumiActivityFeed as ActivityFeed, LumiButton as Button, LumiCard as Card, LumiGrid as Grid, LumiStack as Stack, LumiTable as Table, LumiTimeline as Timeline } from '@duxweb/lumi-ui'
import { useState } from 'react'

interface Shortcut {
  to: string
  /** Any HugeIcons name; the card loads it on demand. */
  icon: string
  title: string
  detail: string
}

interface Task {
  id: string
  title: string
  detail: string
  status?: 'agent' | 'due'
  /** Rows without it only appear under "This week". */
  today?: boolean
  done?: boolean
}

interface Project {
  name: string
  figure: string
  progress: number
  owner: string
  due?: string
  behind?: string
}

interface TeamMember {
  name: string
  role: string
  status: 'online' | 'away' | 'off'
  open: number
}

// A store operator's day: what needs doing, what is booked, how the team and
// the projects stand. Figures are fixed demo copy; the pages they open are live.
const SHORTCUTS: readonly Shortcut[] = [
  { to: '/products/new', icon: 'package', title: 'New product', detail: 'Drafts autosave' },
  { to: '/orders', icon: 'delivery-truck-01', title: 'Ship orders', detail: '11 ready to ship' },
  { to: '/orders', icon: 'arrow-turn-backward', title: 'After-sales', detail: '3 refunds waiting' },
  { to: '/customers', icon: 'user-group', title: 'Customers', detail: '22 bought this month' },
]

const TASKS: readonly Task[] = [
  { id: 'overdue-orders', title: 'Handle 3 overdue orders', detail: 'Hangzhou warehouse, 26 hours overdue', status: 'agent', today: true },
  { id: 'refund', title: 'Review refund RF1028-07', detail: '$312.00 from Xu Jiahe, before 24:00', status: 'due', today: true },
  { id: 'restock', title: 'Restock the linen bedding set', detail: '6 left, about 2 days of stock', status: 'agent', today: true },
  { id: 'questions', title: 'Reply to 4 product questions', detail: 'The oldest is 2 hours old', today: true },
  { id: 'pricing', title: 'Confirm Double 11 pricing', detail: 'Done at 18:20', today: true, done: true },
  { id: 'supplier', title: 'Renew the packaging supplier contract', detail: 'Expires Friday, quote received' },
  { id: 'returns', title: 'Audit last week\'s returns', detail: '18 returns, 2 flagged for review' },
]

const SCHEDULE: TimelineProps['items'] = [
  { key: 'standup', title: 'Team stand-up', description: 'Warehouse, support and marketing', timestamp: '09:30', tone: 'success', status: 'complete' },
  { key: 'supplier', title: 'Call with the packaging supplier', description: 'Renewal terms and the new quote', timestamp: '11:00', tone: 'success', status: 'complete' },
  { key: 'campaign', title: 'Double 11 campaign review', description: 'Final pricing and the landing page', timestamp: '14:30', tone: 'brand', status: 'current' },
  { key: 'payout', title: 'Weekly payout cut-off', description: 'Refunds after 18:00 move to next week', timestamp: '18:00', tone: 'warning', status: 'upcoming' },
  { key: 'digest', title: 'Agent daily digest', description: 'Sales, stock and open tickets', timestamp: '21:00', tone: 'neutral', status: 'upcoming' },
]

const PROJECTS: readonly Project[] = [
  { name: 'Double 11 campaign prep', figure: '72%', progress: 72, owner: 'Wang Siyuan', due: 'Due Nov 5' },
  { name: 'Autumn and winter launch', figure: '18 / 40 styles', progress: 45, owner: 'Zhao Anqi', due: 'Due Nov 10' },
  { name: 'Hangzhou warehouse rota', figure: '30%', progress: 30, owner: 'Chen Zimo', behind: '2 days behind' },
]

const TEAM: readonly TeamMember[] = [
  { name: 'Wang Siyuan', role: 'Campaigns', status: 'online', open: 6 },
  { name: 'Zhao Anqi', role: 'Merchandising', status: 'online', open: 4 },
  { name: 'Chen Zimo', role: 'Warehouse', status: 'away', open: 9 },
  { name: 'Xu Jiahe', role: 'Customer support', status: 'online', open: 3 },
  { name: 'Li Wei', role: 'Finance', status: 'off', open: 2 },
]

const STATUS_TONES: Record<TeamMember['status'], Tone> = { online: 'success', away: 'warning', off: 'neutral' }
const STATUS_LABELS: Record<TeamMember['status'], string> = { online: 'Online', away: 'Away', off: 'Off today' }

// A phrase that names `{actor}` or `{target}` keeps its own word order in every language.
const ACTIVITY = [
  { id: 'a1', actor: 'Agent', action: '{actor} drafted a follow-up for {target}', target: '3 overdue orders', time: '20:15', kind: 'Orders', review: true },
  { id: 'a2', actor: 'Zhao Anqi', action: 'published', target: '4 new products', time: '19:02', kind: 'Catalog' },
  { id: 'a3', actor: 'You', action: '{actor} confirmed pricing for {target}', target: '32 Double 11 products', time: '18:20', kind: 'Pricing' },
  { id: 'a4', actor: 'Wang Siyuan', action: '{actor} moved {target} to 14:30', target: 'the campaign review', time: '16:47', kind: 'Schedule' },
  { id: 'a5', actor: 'Xu Jiahe', action: 'closed', target: '12 support tickets', time: '15:10', kind: 'Support' },
]

const VIEWS = ['today', 'week'] as const

/**
 * Today's work for one operator: the figures to watch, shortcuts, the to-do
 * list beside today's schedule, project and team status, and what changed.
 */
export function AdminWorkbenchRoute(): ReactElement {
  const t = useTranslate()
  const toast = useToast()
  const [view, setView] = useState<string>('today')
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set(TASKS.filter(task => task.done).map(task => task.id)))

  const toggle = (id: string, checked: boolean): void => {
    setDone((current) => {
      const next = new Set(current)
      if (checked)
        next.add(id)
      else
        next.delete(id)
      return next
    })
    const task = TASKS.find(item => item.id === id)
    if (checked && task)
      toast.open({ key: `task-${id}`, tone: 'success', message: t('Task done: {title}', { title: t(task.title) }) })
  }

  const openToday = TASKS.filter(task => task.today && !done.has(task.id))
  const prepared = openToday.filter(task => task.status === 'agent').length
  const visible = view === 'today' ? TASKS.filter(task => task.today) : TASKS
  const openVisible = visible.filter(task => !done.has(task.id)).length
  const summary = openToday.length === 0
    ? t('Nothing left for today')
    : prepared > 0
      ? t('{count} tasks left today, {prepared} already prepared by Agent', { count: openToday.length, prepared })
      : t('{count} tasks left today', { count: openToday.length })

  return (
    <LumiDashboardPage
      title={t('Good evening, Ada')}
      description={`${t('Monday, November 3')} · ${summary}`}
      actions={(
        <Stack direction="horizontal" gap="sm" wrap>
          <Button appearance="outline" icon="sliders" label={t('Customize')} />
          <Button appearance="brand" icon="plus" label={t('New product')} href="/products/new" />
        </Stack>
      )}
      metrics={[
        { key: 'sales', icon: 'receipt', label: t('Sales today'), value: '$4,812', description: t('Compared with yesterday by 21:00'), change: '+8.4%', tone: 'success', series: [210, 340, 280, 520, 610, 480, 590, 720, 640, 810, 760, 900] },
        { key: 'ship', icon: 'delivery-truck-01', label: t('To ship'), value: '11', description: t('3 of them past the 24-hour promise'), change: t('3 late'), tone: 'warning', series: [6, 8, 5, 9, 7, 12, 11] },
        { key: 'after-sales', icon: 'arrow-turn-backward', label: t('After-sales'), value: '3', description: t('Refunds waiting for a decision'), change: '-2', tone: 'success', series: [5, 4, 6, 5, 3, 5, 3] },
        { key: 'messages', icon: 'message-01', label: t('Unread messages'), value: '7', description: t('The oldest arrived 2 hours ago'), tone: 'neutral', series: [2, 3, 1, 4, 0, 5, 7] },
      ]}
    >
      <Grid data-span="full" minColumnWidth={220} gap="md" align="stretch" aria-label={t('Shortcuts')}>
        {SHORTCUTS.map(item => (
          <Card key={item.title} href={item.to} icon={item.icon} title={t(item.title)} description={t(item.detail)} />
        ))}
      </Grid>

      <LumiDashboardCard
        flush
        title={t('To-do')}
        description={t('{count} open', { count: openVisible })}
        action={<LumiSegmented ariaLabel={t('To-do period')} options={VIEWS.map(value => ({ value, label: value === 'today' ? t('Today') : t('This week') }))} value={view} onChange={setView} />}
      >
        <LumiRecordList
          ariaLabel={t('To-do')}
          items={visible.map((task) => {
            const checked = done.has(task.id)
            return {
              key: task.id,
              title: t(task.title),
              description: t(task.detail),
              checked,
              onCheckedChange: (next: boolean) => toggle(task.id, next),
              status: checked ? undefined : task.status === 'agent' ? { label: t('Agent ready'), tone: 'brand' as const } : task.status === 'due' ? { label: t('Due today'), tone: 'warning' as const } : undefined,
            }
          })}
        />
      </LumiDashboardCard>

      <LumiDashboardCard title={t('Today\'s schedule')} description={t('5 events, 2 done')} action={<Button label={t('Calendar')} appearance="outline" size="sm" icon="calendar-03" />}>
        <Timeline items={SCHEDULE.map(item => ({ ...item, title: t(item.title), description: item.description && t(item.description) }))} />
      </LumiDashboardCard>

      <LumiDashboardCard flush title={t('Projects')} description={t('3 active, 1 behind schedule')} action={<Button label={t('All projects')} appearance="outline" size="sm" href="/projects/cards" />}>
        <LumiRecordList
          ariaLabel={t('Project progress')}
          items={PROJECTS.map(project => ({
            key: project.name,
            title: t(project.name),
            value: t(project.figure),
            progress: { value: project.progress, tone: project.behind ? 'warning' as const : 'brand' as const },
            description: project.owner,
            status: project.behind ? { label: t(project.behind), tone: 'warning' as const } : undefined,
            meta: project.due && t(project.due),
          }))}
        />
      </LumiDashboardCard>

      <LumiDashboardCard flush title={t('Team on duty')} description={t('3 online now')} action={<Button label={t('Users')} appearance="outline" size="sm" href="/users" />}>
        <Table
          aria-label={t('Team on duty')}
          showHeader={false}
          rowKey="name"
          rows={TEAM.map(member => ({ ...member, role: t(member.role), statusLabel: t(STATUS_LABELS[member.status]), openLabel: t('{count} open', { count: member.open }) }))}
          columns={[
            { field: 'name', label: t('Name'), kind: 'entity', initials: true, descriptionField: 'role' },
            { field: 'status', label: t('Status'), kind: 'badge', labelField: 'statusLabel', toneMap: STATUS_TONES },
            { field: 'openLabel', label: t('Open tasks'), align: 'right', width: '6rem' },
          ]}
        />
      </LumiDashboardCard>

      <LumiDashboardCard span="full" title={t('Recent activity')} description={t('What changed in the store today')}>
        <ActivityFeed
          ariaLabel={t('Recent activity')}
          items={ACTIVITY.map(entry => ({
            key: entry.id,
            actor: entry.actor === 'You' ? t('You') : entry.actor,
            action: t(entry.action),
            target: t(entry.target),
            context: t(entry.kind),
            status: entry.review ? { label: t('Needs review'), tone: 'brand' as const } : undefined,
            timestamp: entry.time,
          }))}
        />
      </LumiDashboardCard>
    </LumiDashboardPage>
  )
}
