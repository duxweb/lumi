import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import {
  useChangeLocale,
  useDialog,
  useDrawer,
  useFormatCurrency,
  useFormatDate,
  useFormatDateTime,
  useFormatNumber,
  useFormatRelativeTime,
  useLocale,
  useModal,
  useNavigation,
  useNotify,
  useOverlay,
  useParsedLocation,
  useToast,
  useTranslate,
} from '@duxweb/lumi'
import { LumiCodeExample, LumiSegmented, useAdminDrawer, useAssistantContext, useDocumentTitle, useShell, useUnsavedChangesGuard } from '@duxweb/lumi-admin'
import {
  LumiBadge as Badge,
  LumiButton as Button,
  LumiCheckboxGroup as CheckboxGroup,
  LumiDescriptionList as DescriptionList,
  LumiInput as Input,
  LumiStack as Stack,
  LumiTable as Table,
  LumiText as Text,
} from '@duxweb/lumi-ui'
import { useRef, useState } from 'react'
import { Code, DeveloperPage } from '../developer/kit.js'
import { json } from '../developer/source.js'
import { perLocale } from '../shared.js'

// Headless hooks from @duxweb/lumi and @duxweb/lumi-admin, each one live.
// Every preview calls the hook exactly as its hooks.tsx tab shows.

function snippet(code: string): CodeFile {
  return { name: 'hooks.tsx', language: 'tsx', code }
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */

const TOAST_SOURCE = snippet(`import { useNotify, useToast } from '@duxweb/lumi'

function Feedback() {
  const toast = useToast()
  const notify = useNotify()
  return (
    <>
      <Button label="Toast" onClick={() => toast.open({ tone: 'success', message: 'Saved' })} />
      <Button
        label="Notify"
        onClick={() => notify.open({
          key: 'order-1024',
          tone: 'info',
          title: 'Order #1024 shipped',
          description: 'Tracking number 7741 0032 1180',
          duration: 0,
          // Pressing an action runs it and closes the notice.
          actions: [{ label: 'Undo', onPress: () => toast.open({ message: 'Shipment undone' }) }],
        })}
      />
    </>
  )
}`)

function ToastExample(): ReactElement {
  const t = useTranslate()
  const toast = useToast()
  const notify = useNotify()
  return (
    <LumiCodeExample
      title={t('Toasts and notices')}
      code={<Code files={[TOAST_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack direction="horizontal" gap="sm" wrap>
          <Button label={t('Toast')} appearance="outline" icon="checkmark-circle-02" data-testid="hooks-toast" onClick={() => toast.open({ tone: 'success', message: t('Saved') })} />
          <Button
            label={t('Notify')}
            appearance="outline"
            icon="notification-03"
            data-testid="hooks-notify"
            onClick={() => notify.open({
              key: 'order-1024',
              tone: 'info',
              title: t('Order #1024 shipped'),
              description: t('Tracking number 7741 0032 1180'),
              duration: 0,
              actions: [{ label: t('Undo'), onPress: () => toast.open({ message: t('Shipment undone') }) }],
            })}
          />
        </Stack>
      )}
    />
  )
}

const DIALOG_SOURCE = snippet(`import { useDialog, useToast } from '@duxweb/lumi'

function Dialogs() {
  const dialog = useDialog()
  const toast = useToast()

  async function archive() {
    // true on confirm; false on cancel or dismiss.
    const ok = await dialog.confirm({
      title: 'Archive 3 orders?',
      message: 'Archived orders leave the queue but keep their history',
      tone: 'warning',
      confirmText: 'Archive',
      cancelText: 'Cancel',
    })
    toast.open({ message: ok ? 'Archived' : 'Kept' })
  }

  async function reject() {
    // prompt resolves true / false / undefined; the content keeps its own value.
    let reason = ''
    const ok = await dialog.prompt({
      title: 'Reject the refund?',
      confirmText: 'Reject',
      cancelText: 'Cancel',
      render: () => <Input ariaLabel="Reason" onChange={value => reason = value} />,
    })
    if (ok === true)
      toast.open({ tone: 'warning', message: \`Rejected: \${reason || 'no reason'}\` })
  }

  return <><Button label="Confirm" onClick={archive} /><Button label="Prompt" onClick={reject} /></>
}`)

function ReasonInput({ onChange }: { onChange: (value: string) => void }): ReactElement {
  const t = useTranslate()
  const [value, setValue] = useState('')
  return (
    <Input
      ariaLabel={t('Reason')}
      placeholder={t('Reason for the customer')}
      value={value}
      data-testid="hooks-prompt-input"
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

function DialogExample(): ReactElement {
  const t = useTranslate()
  const dialog = useDialog()
  const toast = useToast()
  const archive = async (): Promise<void> => {
    const ok = await dialog.confirm({
      title: t('Archive 3 orders?'),
      message: t('Archived orders leave the queue but keep their history'),
      tone: 'warning',
      confirmText: t('Archive'),
      cancelText: t('Cancel'),
    })
    toast.open({ message: ok ? t('Archived') : t('Kept') })
  }
  const reject = async (): Promise<void> => {
    let reason = ''
    const ok = await dialog.prompt({
      title: t('Reject the refund?'),
      confirmText: t('Reject'),
      cancelText: t('Cancel'),
      render: () => <ReasonInput onChange={(value) => { reason = value }} />,
    })
    if (ok === true)
      toast.open({ tone: 'warning', message: t('Rejected: {reason}', { reason: reason || t('no reason') }) })
  }
  return (
    <LumiCodeExample
      title={t('Confirm and prompt')}
      code={<Code files={[DIALOG_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack direction="horizontal" gap="sm" wrap>
          <Button label={t('Confirm')} appearance="outline" data-testid="hooks-confirm" onClick={() => void archive()} />
          <Button label={t('Prompt')} appearance="outline" data-testid="hooks-prompt" onClick={() => void reject()} />
        </Stack>
      )}
    />
  )
}

const OVERLAY_SOURCE = snippet(`import { useDrawer, useModal, useOverlay, useToast } from '@duxweb/lumi'

function Overlays() {
  const modal = useModal()
  const drawer = useDrawer()
  const overlay = useOverlay()
  const toast = useToast()

  async function pickPlan() {
    // The content closes its own handle with a value; result resolves with it.
    const handle = modal.open({
      title: 'Choose a plan',
      render: () => (
        <>
          <Button label="Monthly" onClick={() => handle.close('monthly')} />
          <Button label="Yearly" onClick={() => handle.close('yearly')} />
        </>
      ),
    })
    const plan = await handle.result
    if (plan)
      toast.open({ message: \`Plan: \${plan}\` })
  }

  return (
    <>
      <Button label="Modal" onClick={pickPlan} />
      <Button label="Drawer" onClick={() => drawer.open({ title: 'Order #1024', placement: 'right', render: () => <OrderSummary /> })} />
      {/* useOverlay is the controller under all three: any type, any option. */}
      <Button label="Bottom sheet" onClick={() => overlay.open({ type: 'drawer', placement: 'bottom', title: 'Shortcuts', render: () => <Shortcuts /> })} />
    </>
  )
}`)

function OrderSummary(): ReactElement {
  const t = useTranslate()
  return (
    <DescriptionList items={[
      { label: t('Customer'), value: 'Ada Lovelace' },
      { label: t('Status'), value: t('Shipped') },
      { label: t('Items'), value: 3 },
      { label: t('Total'), value: '$184.00' },
    ]}
    />
  )
}

function Shortcuts(): ReactElement {
  const t = useTranslate()
  return (
    <DescriptionList items={[
      { label: t('Search'), value: '⌘ K' },
      { label: t('Toggle the sidebar'), value: '⌘ B' },
      { label: t('Close the overlay'), value: 'Esc' },
    ]}
    />
  )
}

function OverlayExample(): ReactElement {
  const t = useTranslate()
  const modal = useModal()
  const drawer = useDrawer()
  const overlay = useOverlay()
  const toast = useToast()
  const pickPlan = async (): Promise<void> => {
    const handle = modal.open({
      title: t('Choose a plan'),
      render: () => (
        <Stack direction="horizontal" gap="sm">
          <Button label={t('Monthly')} appearance="outline" data-testid="hooks-plan-monthly" onClick={() => void handle.close('monthly')} />
          <Button label={t('Yearly')} data-testid="hooks-plan-yearly" onClick={() => void handle.close('yearly')} />
        </Stack>
      ),
    })
    const plan = await handle.result
    if (plan)
      toast.open({ message: t('Plan: {plan}', { plan: plan === 'yearly' ? t('Yearly') : t('Monthly') }) })
  }
  return (
    <LumiCodeExample
      title={t('Modals and drawers with your content')}
      code={<Code files={[OVERLAY_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack direction="horizontal" gap="sm" wrap>
          <Button label={t('Modal')} appearance="outline" data-testid="hooks-modal" onClick={() => void pickPlan()} />
          <Button label={t('Drawer')} appearance="outline" data-testid="hooks-drawer" onClick={() => drawer.open({ title: t('Order #1024'), placement: 'right', render: () => <OrderSummary /> })} />
          <Button label={t('Bottom sheet')} appearance="outline" data-testid="hooks-sheet" onClick={() => overlay.open({ type: 'drawer', placement: 'bottom', title: t('Shortcuts'), render: () => <Shortcuts /> })} />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Language and formatting                                                    */

const LOCALE_SOURCE = snippet(`import {
  useChangeLocale, useFormatCurrency, useFormatDate, useFormatDateTime,
  useFormatNumber, useFormatRelativeTime, useLocale, useTranslate,
} from '@duxweb/lumi'

function Formats() {
  const t = useTranslate()
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const number = useFormatNumber()
  const currency = useFormatCurrency()
  const date = useFormatDate()
  const dateTime = useFormatDateTime()
  const relative = useFormatRelativeTime()

  // Each hook re-renders when the locale changes.
  const rows = [
    { hook: 'useTranslate', result: t('Saved {count} orders', { count: 3 }) },
    { hook: 'useFormatNumber', result: number(1234567.891) },
    { hook: 'useFormatNumber', result: number(0.256, { style: 'percent' }) },
    // Currency and time zone come from i18n.format in the config.
    { hook: 'useFormatCurrency', result: currency(1999.5) },
    { hook: 'useFormatDate', result: date(new Date(2026, 10, 10), { dateStyle: 'long' }) },
    { hook: 'useFormatDateTime', result: dateTime('2026-11-10T14:30:00Z', { dateStyle: 'medium', timeStyle: 'short' }) },
    { hook: 'useFormatRelativeTime', result: relative(-3, 'day', { numeric: 'auto' }) },
  ]
  return (
    <>
      <Segmented value={locale} onChange={value => void changeLocale(value)} options={[
        { value: 'en-US', label: 'en-US' },
        { value: 'zh-CN', label: 'zh-CN' },
      ]} />
      <Table rowKey="hook" columns={columns} rows={rows} />
    </>
  )
}`)

const formatColumns = perLocale((t): TableColumn[] => ([
  { field: 'hook', label: t('Hook'), kind: 'code' },
  { field: 'call', label: t('Call'), kind: 'code' },
  { field: 'result', label: t('Result') },
]))

function LocaleExample(): ReactElement {
  const t = useTranslate()
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const number = useFormatNumber()
  const currency = useFormatCurrency()
  const date = useFormatDate()
  const dateTime = useFormatDateTime()
  const relative = useFormatRelativeTime()
  const rows = [
    { id: 'translate', hook: 'useTranslate', call: `t('Saved {count} orders', { count: 3 })`, result: t('Saved {count} orders', { count: 3 }) },
    { id: 'number', hook: 'useFormatNumber', call: 'number(1234567.891)', result: number(1234567.891) },
    { id: 'percent', hook: 'useFormatNumber', call: `number(0.256, { style: 'percent' })`, result: number(0.256, { style: 'percent' }) },
    { id: 'currency', hook: 'useFormatCurrency', call: 'currency(1999.5)', result: currency(1999.5) },
    { id: 'date', hook: 'useFormatDate', call: `date(new Date(2026, 10, 10), { dateStyle: 'long' })`, result: date(new Date(2026, 10, 10), { dateStyle: 'long' }) },
    { id: 'datetime', hook: 'useFormatDateTime', call: `dateTime('2026-11-10T14:30:00Z', { dateStyle: 'medium', timeStyle: 'short' })`, result: dateTime('2026-11-10T14:30:00Z', { dateStyle: 'medium', timeStyle: 'short' }) },
    { id: 'relative', hook: 'useFormatRelativeTime', call: `relative(-3, 'day', { numeric: 'auto' })`, result: relative(-3, 'day', { numeric: 'auto' }) },
  ]
  return (
    <LumiCodeExample
      title={t('Translation and locale formats')}
      layout="stack"
      code={<Code files={[LOCALE_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <LumiSegmented ariaLabel={t('Language')} value={locale} onChange={value => void changeLocale(value)} options={[{ value: 'en-US', label: 'en-US' }, { value: 'zh-CN', label: 'zh-CN' }]} />
            <Text variant="muted" text={t('Active locale: {locale}', { locale })} />
          </Stack>
          <Table rowKey="id" columns={formatColumns(t)} rows={rows} data-testid="hooks-formats" />
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */

const NAVIGATION_SOURCE = snippet(`import { useNavigation, useParsedLocation } from '@duxweb/lumi'

function Location() {
  const location = useParsedLocation()
  const navigation = useNavigation()
  const step = Number(location.query?.step ?? 0)
  return (
    <>
      <DescriptionList items={[
        { label: 'pathname', value: location.pathname },
        { label: 'query', value: JSON.stringify(location.query ?? {}) },
        { label: 'params', value: JSON.stringify(location.params) },
      ]} />
      {/* Without \`to\`, go stays on the current path and replaces the query. */}
      <Button label="Next step" onClick={() => navigation.go({ query: { ...location.query, step: step + 1 } })} />
      <Button label="Clear query" onClick={() => navigation.go({ query: {}, replace: true })} />
      <Button label="Back" onClick={() => navigation.back()} />
    </>
  )
}`)

function NavigationExample(): ReactElement {
  const t = useTranslate()
  const location = useParsedLocation()
  const navigation = useNavigation()
  const step = Number(location.query?.step ?? 0)
  return (
    <LumiCodeExample
      title={t('Read and change the location')}
      code={<Code files={[NAVIGATION_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <DescriptionList
            data-testid="hooks-location"
            items={[
              { label: 'pathname', value: location.pathname },
              { label: 'query', value: json(location.query ?? {}) },
              { label: 'params', value: json(location.params) },
            ]}
          />
          <Stack direction="horizontal" gap="sm" wrap>
            <Button label={t('Next step')} appearance="outline" icon="arrow-right-02" data-testid="hooks-next-step" onClick={() => navigation.go({ query: { ...location.query, step: step + 1 } })} />
            <Button label={t('Clear query')} appearance="outline" data-testid="hooks-clear-query" onClick={() => navigation.go({ query: {}, replace: true })} />
            <Button label={t('Back')} appearance="ghost" icon="arrow-left-02" onClick={() => navigation.back()} />
          </Stack>
        </Stack>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Admin shell                                                                */

const SHELL_SOURCE = snippet(`import { useDocumentTitle, useShell } from '@duxweb/lumi-admin'

function ShellState() {
  const shell = useShell()
  const [title, setTitle] = useState('Order #1024')
  // Replaces the menu label in the browser tab while this component is mounted.
  useDocumentTitle(title)
  return (
    <>
      <DescriptionList items={[
        { label: 'Menu item', value: shell.active.item?.label },
        { label: 'Breadcrumbs', value: shell.active.breadcrumbs.map(item => item.label).join(' / ') },
        { label: 'Assistant', value: shell.assistant.open ? 'Open' : 'Closed' },
      ]} />
      {shell.assistant.available && <Button label="Toggle assistant" onClick={shell.assistant.toggle} />}
      <Input ariaLabel="Tab title" value={title} onChange={setTitle} />
    </>
  )
}`)

function TabTitle({ title }: { title: string }): null {
  useDocumentTitle(title)
  return null
}

function ShellExample(): ReactElement {
  const t = useTranslate()
  const shell = useShell()
  const [title, setTitle] = useState(() => t('Order #1024'))
  const item = shell.active.item
  return (
    <LumiCodeExample
      title={t('Shell state and the tab title')}
      code={<Code files={[SHELL_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <TabTitle title={title} />
          <DescriptionList
            data-testid="hooks-shell"
            items={[
              { label: t('Menu item'), value: item ? String(item.label) : '—' },
              { label: t('Breadcrumbs'), value: shell.active.breadcrumbs.map(entry => entry.label).join(' / ') || '—' },
              { label: t('Assistant'), value: shell.assistant.open ? t('Open') : t('Closed') },
            ]}
          />
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            {shell.assistant.available && <Button label={shell.assistant.open ? t('Close assistant') : t('Open assistant')} appearance="outline" icon="ai-chat-02" data-testid="hooks-toggle-assistant" onClick={shell.assistant.toggle} />}
            <Input ariaLabel={t('Tab title')} placeholder={t('Tab title')} value={title} data-testid="hooks-tab-title" onChange={setTitle} />
          </Stack>
        </Stack>
      )}
    />
  )
}

const CONTEXT_SOURCE = snippet(`import { useAssistantContext, useShell } from '@duxweb/lumi-admin'

const ORDERS = [
  { id: '1024', number: '#1024', customer: 'Ada Lovelace' },
  { id: '1025', number: '#1025', customer: 'Alan Turing' },
  { id: '1026', number: '#1026', customer: 'Grace Hopper' },
]

function PickForAssistant() {
  const shell = useShell()
  const [picked, setPicked] = useState(['1024'])
  // Offered as chips in the assistant composer while this component is mounted;
  // the reader can remove one before sending.
  useAssistantContext(ORDERS.filter(order => picked.includes(order.id)).map(order => ({
    id: \`orders:\${order.id}\`,
    label: order.number,
    kind: 'record',
    description: order.customer,
    data: order,
  })))
  return (
    <>
      <CheckboxGroup ariaLabel="Orders" value={picked} onChange={setPicked}
        options={ORDERS.map(order => ({ label: order.number, value: order.id, description: order.customer }))} />
      {!shell.assistant.open && <Button label="Open assistant" onClick={shell.assistant.toggle} />}
    </>
  )
}`)

const CONTEXT_ORDERS = [
  { id: '1024', number: '#1024', customer: 'Ada Lovelace' },
  { id: '1025', number: '#1025', customer: 'Alan Turing' },
  { id: '1026', number: '#1026', customer: 'Grace Hopper' },
]

function AssistantContextExample(): ReactElement {
  const t = useTranslate()
  const shell = useShell()
  const [picked, setPicked] = useState<string[]>(['1024'])
  useAssistantContext(CONTEXT_ORDERS.filter(order => picked.includes(order.id)).map(order => ({
    id: `orders:${order.id}`,
    label: order.number,
    kind: 'record' as const,
    description: order.customer,
    data: order,
  })))
  return (
    <LumiCodeExample
      title={t('Context for the assistant')}
      code={<Code files={[CONTEXT_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <CheckboxGroup
            ariaLabel={t('Orders')}
            data-testid="hooks-context-orders"
            value={picked}
            onChange={value => setPicked(value.map(String))}
            options={CONTEXT_ORDERS.map(order => ({ label: order.number, value: order.id, description: order.customer }))}
          />
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            {shell.assistant.available && !shell.assistant.open && <Button label={t('Open assistant')} appearance="outline" icon="ai-chat-02" data-testid="hooks-context-open" onClick={shell.assistant.toggle} />}
            <Text variant="muted" text={t('{count} offered to the assistant', { count: picked.length })} />
          </Stack>
        </Stack>
      )}
    />
  )
}

const DRAWER_SOURCE = snippet(`import { useAdminDrawer } from '@duxweb/lumi-admin'

// Drawers are registered once: mountAdmin(config, { drawers: { notifications: { … } } }).
function OpenNotifications() {
  const drawer = useAdminDrawer()
  return (
    <>
      {/* Adds ?drawer=notifications, so Back and a shared link reopen it. */}
      <Button label="Notifications" onClick={() => drawer.open('notifications')} />
      <Badge label={drawer.activeKey ?? 'none'} />
    </>
  )
}`)

function AdminDrawerExample(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  return (
    <LumiCodeExample
      title={t('Routed drawers')}
      code={<Code files={[DRAWER_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack direction="horizontal" gap="sm" align="center" wrap>
          <Button label={t('Notifications')} appearance="outline" icon="notification-03" data-testid="hooks-admin-drawer" onClick={() => drawer.open('notifications')} />
          <Badge appearance="outline" label={t('Open drawer: {key}', { key: drawer.activeKey ?? t('none') })} />
        </Stack>
      )}
    />
  )
}

const GUARD_SOURCE = snippet(`import { useUnsavedChangesGuard } from '@duxweb/lumi-admin'

function Draft() {
  const [saved, setSaved] = useState('Ships Monday')
  const [draft, setDraft] = useState(saved)
  const dirty = draft !== saved
  // While dirty, leaving the page (menu, tab, Back, reload) asks first.
  const guard = useUnsavedChangesGuard({ dirty, owner: 'order-note' })
  return (
    <>
      <Input ariaLabel="Order note" value={draft} onChange={setDraft} />
      <Button label="Save" disabled={!dirty} onClick={() => setSaved(draft)} />
      {/* request() asks the same question before any in-page transition. */}
      <Button label="Discard" disabled={!dirty} onClick={() => guard.request(() => setDraft(saved))} />
    </>
  )
}`)

function UnsavedGuardExample(): ReactElement {
  const t = useTranslate()
  const toast = useToast()
  const initial = useRef(t('Ships Monday'))
  const [saved, setSaved] = useState(initial.current)
  const [draft, setDraft] = useState(initial.current)
  const dirty = draft !== saved
  const guard = useUnsavedChangesGuard({ dirty, owner: 'hooks-order-note' })
  return (
    <LumiCodeExample
      title={t('Ask before losing changes')}
      code={<Code files={[GUARD_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <Input ariaLabel={t('Order note')} value={draft} data-testid="hooks-guard-input" onChange={setDraft} />
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button
              label={t('Save')}
              disabled={!dirty}
              data-testid="hooks-guard-save"
              onClick={() => {
                setSaved(draft)
                toast.open({ tone: 'success', message: t('Saved') })
              }}
            />
            <Button label={t('Discard')} appearance="outline" disabled={!dirty} data-testid="hooks-guard-discard" onClick={() => guard.request(() => setDraft(saved))} />
            <Badge dot tone={dirty ? 'warning' : 'success'} label={dirty ? t('Unsaved changes') : t('All changes saved')} />
          </Stack>
        </Stack>
      )}
    />
  )
}

export function AdminHooksAppRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('App and Shell hooks')} description={t('Feedback, language, navigation and the Admin Shell')}>
      <ToastExample />
      <DialogExample />
      <OverlayExample />
      <LocaleExample />
      <NavigationExample />
      <ShellExample />
      <AssistantContextExample />
      <AdminDrawerExample />
      <UnsavedGuardExample />
    </DeveloperPage>
  )
}
