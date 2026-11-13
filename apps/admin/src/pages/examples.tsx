import type { LumiRecoverableStateKind } from '@duxweb/lumi-admin'
import type { ReactElement } from 'react'
import { useCustom, useForm, useFormatDate, useTable, useToast, useTranslate } from '@duxweb/lumi'
import { LumiDashboardCard, LumiDashboardPage, LumiEmptyState, LumiFormPage, LumiFormRow, LumiFormSection, LumiLoadingState, LumiPage, LumiPageHeader, LumiRecordList, LumiSegmented } from '@duxweb/lumi-admin'
import { LumiActivityFeed as ActivityFeed, LumiAvatar as Avatar, LumiBadge as Badge, LumiButton as Button, LumiCard as Card, LumiDescriptionList as DescriptionList, LumiFormField as FormField, LumiGrid as Grid, LumiHeading as Heading, LumiStack as Stack, LumiTag as Tag, LumiText as Text } from '@duxweb/lumi-ui'
import { LumiChart as Chart } from '@duxweb/lumi-ui/charts'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { perLocale } from '../shared.js'

const TIER_OPTIONS = perLocale(t => [{ value: 'standard', label: t('Standard') }, { value: 'gold', label: t('Gold') }, { value: 'enterprise', label: t('Enterprise') }])

export function AdminBasicFormRoute(): ReactElement {
  const t = useTranslate()
  const [savedId, setSavedId] = useState<number>()
  const form = useForm<{ id?: number, name: string, email: string, tier: string }>({
    resource: 'customers',
    initialValues: { name: '', email: '', tier: 'standard' },
    rules: { type: 'object', required: ['name', 'email'], properties: { name: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' } } },
  })
  const error = (name: string): string | undefined => form.errors.find(issue => issue.path === name)?.message
  return (
    <LumiFormPage
      title={t('Basic form')}
      description={t('Create a customer with field validation, save/reset and unsaved-change protection')}
      form={form}
      saveLabel={t('Create customer')}
      onSaved={result => setSavedId(Number(result.data.id))}
      actions={savedId
        ? <Badge role="status" tone="success" label={t('Customer #{id} created', { id: savedId })} />
        : undefined}
    >
      <LumiFormSection title={t('Customer details')} description={t('Contact information and account tier')}>
        <LumiFormRow><FormField name="name" label={t('Customer name')} required value={form.values.name} error={error('name')} onChange={value => form.setValue('name', value)} /></LumiFormRow>
        <LumiFormRow><FormField name="email" label={t('Email address')} type="email" required value={form.values.email} error={error('email')} onChange={value => form.setValue('email', value)} /></LumiFormRow>
        <LumiFormRow><FormField name="tier" label={t('Tier')} fieldType="enum" widget="Select" options={TIER_OPTIONS(t)} value={form.values.tier} onChange={value => form.setValue('tier', value)} /></LumiFormRow>
      </LumiFormSection>
    </LumiFormPage>
  )
}

const states = perLocale((t): Record<LumiRecoverableStateKind, { title: string, reason: string, nextStep: string }> => ({
  empty: { title: t('No records yet'), reason: t('There are no records matching this view'), nextStep: t('Reset the example to restore the sample content') },
  error: { title: t('Could not load records'), reason: t('The request could not be completed'), nextStep: t('Retry to recover the sample content') },
  offline: { title: t('Service offline'), reason: t('The service is currently unavailable'), nextStep: t('Retry after the connection is restored') },
  timeout: { title: t('Request timed out'), reason: t('The service took too long to respond'), nextStep: t('Retry with the same query') },
  permission: { title: t('Access restricted'), reason: t('Your current role cannot view this content'), nextStep: t('Return to the available sample view') },
}))

const STATE_SCENARIOS = perLocale(t => ([
  { value: 'ready', label: t('Ready') },
  { value: 'loading', label: t('Loading') },
  { value: 'empty', label: t('Empty') },
  { value: 'error', label: t('Error') },
  { value: 'offline', label: t('Offline') },
  { value: 'timeout', label: t('Timeout') },
  { value: 'permission', label: t('Permission') },
]))

export function AdminStatesRoute(): ReactElement {
  const t = useTranslate()
  const [state, setState] = useState<'ready' | 'loading' | LumiRecoverableStateKind>('ready')
  return (
    <LumiPage stack>
      <LumiPageHeader title={t('State recovery')} description={t('Choose a scenario and use its recovery action. These controls simulate page states without changing the backend')} />
      <LumiSegmented ariaLabel={t('Page state scenario')} value={state} onChange={value => setState(value as typeof state)} options={STATE_SCENARIOS(t)} />
      {state === 'ready'
        ? (
            <Card title={t('Records are available')} description={t('The sample view has recovered successfully')}>
              <DescriptionList items={[{ label: t('Record'), value: t('Sample customer') }, { label: t('Status'), value: t('Ready') }]} />
            </Card>
          )
        : (
            <Card>
              {state === 'loading'
                ? (
                    <>
                      <LumiLoadingState label={t('Loading sample records')} />
                      <Button label={t('Finish loading')} appearance="outline" onClick={() => setState('ready')} />
                    </>
                  )
                : <LumiEmptyState kind={state} {...states(t)[state]} actionLabel={t('Recover example')} onAction={() => setState('ready')} />}
            </Card>
          )}
    </LumiPage>
  )
}

interface AccountUser {
  name: string
  email: string
  role: string
  bio: string
  phone: string
  team: string
  language: string
  timezone: string
  dateFormat: string
  firstDay: string
  joinedAt: string
  lastSignInAt: string
  lastSignInFrom: string
  twoFactor: boolean
  signInAlerts: boolean
  sessions: number
  passwordChangedAt: string
}

interface AccountActivity {
  id: number
  title: string
  actor: string
  project: string
  tone: string
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = { admin: 'Administrator', manager: 'Manager', support: 'Support' }
const ACTIVITY_STATUS: Record<string, { label: string, tone: 'success' | 'warning' }> = {
  success: { label: 'Completed', tone: 'success' },
  warning: { label: 'Needs review', tone: 'warning' },
}
/** Rows the feed shows before "View all"; enough to sit level with the two cards beside it. */
const RECENT_ACTIVITY = 7

/**
 * The signed-in account at a glance: who you are, how you sign in and what
 * changed lately. Everything is composed from public UI and Admin parts; the
 * profile comes from `/me`, the feed from the `activities` resource.
 */
export function AdminAccountCenterRoute(): ReactElement {
  const t = useTranslate()
  const toast = useToast()
  const formatDate = useFormatDate()
  const navigate = useNavigate()
  const me = useCustom<{ user: AccountUser }>({ url: '/me' })
  const activity = useTable<AccountActivity>({ resource: 'activities', pagination: { pageSize: RECENT_ACTIVITY } })
  const user = me.data?.data.user
  const expanded = activity.pageSize > RECENT_ACTIVITY
  const day = (value: string): string => formatDate(value, { year: 'numeric', month: 'short', day: 'numeric' })
  const moment = (value: string): string => formatDate(value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return (
    <LumiDashboardPage
      title={t('Account center')}
      description={t('Your profile, sign-in security and recent workspace activity')}
      state={me.isPending
        ? { kind: 'loading' }
        : me.error
          ? { kind: 'error', title: t('Account unavailable'), reason: me.error.message, nextStep: t('Retry loading the account'), actionLabel: t('Retry'), onAction: () => void me.refetch() }
          : undefined}
    >
      {user && (
        <Card data-span="full" aria-label={t('Profile')}>
          <Stack direction="horizontal" justify="between" align="center" gap="md" wrap>
            <Stack direction="horizontal" gap="md">
              <Avatar name={user.name} size="xl" />
              <Stack gap="sm">
                <Stack direction="horizontal" gap="sm" wrap>
                  <Heading level="h2" text={user.name} />
                  <Badge label={t(ROLE_LABELS[user.role] ?? user.role)} tone="brand" />
                </Stack>
                <Text variant="muted" text={user.bio} />
                <Stack direction="horizontal" gap="sm" wrap>
                  <Tag icon="mail-01" label={user.email} appearance="outline" />
                  <Tag icon="user-group" label={t(user.team)} appearance="outline" />
                  <Tag icon="calendar-03" label={t('Joined {date}', { date: day(user.joinedAt) })} appearance="outline" />
                </Stack>
              </Stack>
            </Stack>
            <Stack direction="horizontal" gap="sm" wrap>
              <Button appearance="outline" icon="lock-password" label={t('Change password')} onClick={() => toast.open({ key: 'password-reset', tone: 'success', message: t('A reset link is on its way to {email}', { email: user.email }) })} />
              <Button icon="pencil" label={t('Edit profile')} onClick={() => navigate('/settings/profile')} />
            </Stack>
          </Stack>
        </Card>
      )}

      {user && (
        <Stack gap="md">
          <LumiDashboardCard title={t('Account details')} description={t('How you sign in and how dates read for you')}>
            <DescriptionList
              items={[
                { label: t('Username'), value: user.role },
                { label: t('Phone'), value: user.phone },
                { label: t('Language'), value: user.language },
                { label: t('Time zone'), value: user.timezone },
                { label: t('Date format'), value: user.dateFormat },
                { label: t('Start of week'), value: t(user.firstDay) },
              ]}
            />
          </LumiDashboardCard>
          <LumiDashboardCard flush title={t('Security')} description={t('What protects this account at sign-in')}>
            <LumiRecordList
              ariaLabel={t('Security')}
              items={[
                { key: 'two-factor', title: t('Two-factor authentication'), description: user.twoFactor ? t('Authenticator app') : t('Add a second step at sign-in'), status: user.twoFactor ? { label: t('Enabled'), tone: 'success' } : { label: t('Off'), tone: 'warning' } },
                { key: 'alerts', title: t('New sign-in alerts'), description: t('Notify me when my account signs in from a new device'), status: user.signInAlerts ? { label: t('On'), tone: 'success' } : { label: t('Off'), tone: 'neutral' } },
                { key: 'sessions', title: t('Active sessions'), description: t('Last sign-in {time} · {device}', { time: moment(user.lastSignInAt), device: user.lastSignInFrom }), value: user.sessions },
                { key: 'password', title: t('Password'), description: t('Last changed {date}', { date: day(user.passwordChangedAt) }) },
              ]}
            />
          </LumiDashboardCard>
        </Stack>
      )}

      {user && (
        <LumiDashboardCard
          title={t('Recent activity')}
          description={activity.total > 0 ? t('Showing {shown} of {total} events', { shown: activity.rows.length, total: activity.total }) : t('What changed across your workspace')}
          action={activity.total > RECENT_ACTIVITY && (
            <Button
              appearance="outline"
              size="sm"
              label={expanded ? t('Show less') : t('View all')}
              aria-expanded={expanded}
              onClick={() => activity.setPageSize(expanded ? RECENT_ACTIVITY : activity.total)}
            />
          )}
        >
          {activity.query.error
            ? <LumiEmptyState kind="error" title={t('Activity unavailable')} reason={activity.query.error.message} nextStep={t('Retry loading the activity')} actionLabel={t('Retry')} onAction={() => void activity.query.refetch()} />
            : (
                <ActivityFeed
                  ariaLabel={t('Recent activity')}
                  loading={activity.query.isPending}
                  items={activity.rows.map((row) => {
                    const status = ACTIVITY_STATUS[row.tone]
                    return {
                      key: String(row.id),
                      actor: row.actor,
                      action: t('updated'),
                      target: row.project,
                      context: t(row.title),
                      status: status && { label: t(status.label), tone: status.tone },
                      timestamp: moment(row.createdAt),
                      dateTime: row.createdAt,
                    }
                  })}
                />
              )}
        </LumiDashboardCard>
      )}
    </LumiDashboardPage>
  )
}

export function AdminChartsRoute(): ReactElement {
  const t = useTranslate()
  const [empty, setEmpty] = useState(false)
  const points = empty ? [] : [{ label: t('Mon'), value: 18 }, { label: t('Tue'), value: 32 }, { label: t('Wed'), value: 24 }, { label: t('Thu'), value: 48 }, { label: t('Fri'), value: 39 }]
  return (
    <LumiPage stack>
      <LumiPageHeader title={t('Charts')} description={t('The four supported chart types, using a shared sample dataset and theme tokens')} actions={<Button label={empty ? t('Restore sample data') : t('Show empty data')} appearance="outline" onClick={() => setEmpty(value => !value)} />} />
      <Grid minColumnWidth={460}>{([['area', t('Area chart')], ['line', t('Line chart')], ['bar', t('Bar chart')], ['donut', t('Donut chart')]] as const).map(([type, title]) => <Card key={type} title={title} description={t('Sample activity by weekday')}><Chart type={type} points={points} ariaLabel={title} height={260} /></Card>)}</Grid>
    </LumiPage>
  )
}
