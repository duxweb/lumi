import type { TableColumn } from '@duxweb/lumi-ui'
import type { ThemeConfig } from '@duxweb/lumi-ui/catalog'
import type { ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { LumiPage, LumiPageHeader, LumiSegmented, useShell } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, applyLumiTheme, LumiBadge as Badge, LumiButton as Button, LumiCard as Card, LumiColorSwatches as ColorSwatches, LumiDescriptionList as DescriptionList, LumiFormField as FormField, LumiGrid as Grid, LumiInput as Input, LumiStack as Stack, LumiSwitch as Switch, LumiTable as Table, themeToCssVariables } from '@duxweb/lumi-ui'
import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createAdminManifest } from '../manifest.js'
import { perLocale } from '../shared.js'
import { JsonSource } from './json.js'

// Shell and theme showcase. Composed only from public Lumi components.

const manifest = createAdminManifest()
const manifestExcerpt = { app: manifest.app, routes: manifest.routes.filter(route => route.name === 'orders' || route.name === 'shell-layout') }

const HOST_OPTIONS = `createAdmin({
  manifest,                       // app, routes and menu (JSON, validated by lumi-check)
  registry,                       // route page components
  assistantCommands,              // / commands a module adds to the manifest's app.assistant
  onEvent,                        // every module's listener: header actions, assistant.command
  sidebarFooter: <DemoCoverageCard />,
  menuBadges: { orders: { label: 11, tone: 'warning' }, workbench: { label: 5 } },
  drawers: { 'edit-customer': { title: 'Edit customer', component: CustomerEditDrawer } },
})`

const partColumns = perLocale((t): TableColumn[] => ([
  { field: 'part', label: t('Part'), kind: 'code', width: '12rem' },
  { field: 'source', label: t('Source'), width: '10rem' },
  { field: 'detail', label: t('Behaviour'), wrap: true },
]))

const SHELL_PARTS = perLocale(t => ([
  { part: 'app.layout', source: 'manifest', detail: t('"dual" puts modules in a rail and their groups in the sidebar; the menu is built from routes[].menu') },
  { part: 'menu.module / group', source: 'manifest', detail: t('Modules and groups come from each route; order sorts within a group and hidden keeps a route out of the menu') },
  { part: 'app.tabs', source: 'manifest', detail: t('Visited pages stay open as tabs; reload, close others and close all act on them') },
  { part: 'menuBadges', source: 'createAdmin', detail: t('Counts or labels keyed by route name, e.g. the warning badge on Filters & bulk actions') },
  { part: 'sidebarFooter', source: 'createAdmin', detail: t('Any React node under the menu; here the coverage card') },
  { part: 'route.access', source: 'manifest', detail: t('Routes and menu entries the access provider denies are hidden or show the 403 page') },
]))

const COLOR_MODE_LABELS = perLocale(t => ({ light: t('Light'), dark: t('Dark'), system: t('System') }))

export function AdminShellLayoutRoute(): ReactElement {
  const t = useTranslate()
  const shell = useShell()
  const modes = COLOR_MODE_LABELS(t)
  const { preference, resolved } = shell.colorMode
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Layout, menu & badges')}
        description={t('The Shell is described by the manifest a backend can serve; the host only adds React slots. useShell exposes the same state and commands the header and sidebar use')}
      />
      <Card title={t('Live shell state')} description={t('Read from useShell(); it updates as you navigate, collapse the sidebar or open tabs')}>
        <DescriptionList items={[
          { label: t('Breadcrumbs'), value: shell.active.breadcrumbs.map(item => item.label).join(' / ') || '—', span: 'full' },
          { label: t('Sidebar'), value: shell.navigation.collapsed ? t('Collapsed') : t('Expanded') },
          { label: t('Open tabs'), value: shell.tabs.items.length },
          { label: t('Agent panel'), value: shell.assistant.open ? t('Open') : t('Closed') },
          { label: t('Color mode'), value: preference === 'system' ? `${modes.system} · ${modes[resolved]}` : modes[preference] },
        ]}
        />
        <Stack direction="horizontal" gap="sm" wrap>
          <Button label={shell.navigation.collapsed ? t('Expand sidebar') : t('Collapse sidebar')} appearance="outline" onClick={shell.navigation.toggleCollapsed} />
          {shell.assistant.available && <Button label={shell.assistant.open ? t('Close Agent panel') : t('Open Agent panel')} appearance="outline" onClick={shell.assistant.toggle} />}
          {shell.tabs.enabled && shell.tabs.activeKey && <Button label={t('Close other tabs')} appearance="outline" disabled={shell.tabs.items.length < 2} onClick={() => shell.tabs.closeOthers(shell.tabs.activeKey!)} />}
          <Button label={t('Open mobile menu')} appearance="outline" onClick={shell.navigation.openMobile} />
        </Stack>
      </Card>
      <Card title={t('What builds the Shell')}>
        <Table rowKey="part" columns={partColumns(t)} rows={SHELL_PARTS(t)} />
        <JsonSource label={t('Manifest excerpt (JSON)')} value={manifestExcerpt} />
        <JsonSource label={t('Host options (TypeScript)')} value={HOST_OPTIONS} />
      </Card>
    </LumiPage>
  )
}

/* -------------------------------------------------------------------------- */

const RADIUS_OPTIONS = perLocale(t => ([{ value: 'sm', label: t('Small') }, { value: 'md', label: t('Medium') }, { value: 'lg', label: t('Large') }]))
const MODE_OPTIONS = perLocale(t => ([{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }]))
const APP_MODE_OPTIONS = perLocale(t => ([{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }, { value: 'system', label: t('System') }]))
const BRAND_SWATCHES = perLocale(t => ([
  { value: '#2d5bff', label: t('Blue') },
  { value: '#7c3aed', label: t('Violet') },
  { value: '#0891b2', label: t('Cyan') },
  { value: '#16a34a', label: t('Green') },
  { value: '#ea580c', label: t('Orange') },
  { value: '#db2777', label: t('Pink') },
]))

/** Scopes a theme to one element, so the preview never restyles the Shell around it. */
function ThemePreview({ config }: { config: ThemeConfig }): ReactElement {
  const t = useTranslate()
  const target = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!target.current)
      return
    const controller = applyLumiTheme(config, target.current)
    return () => controller.dispose()
  }, [config])
  return (
    <div ref={target} data-testid="theme-preview">
      <Card title={t('Preview')} description={t('Core surfaces with the theme applied to this card only')}>
        <Stack direction="horizontal" gap="sm" wrap>
          <Button label={t('Primary action')} />
          <Button label={t('Brand action')} appearance="brand" />
          <Button label={t('Secondary')} appearance="outline" />
        </Stack>
        <Stack direction="horizontal" gap="sm" wrap>
          <Badge label={t('Paid')} tone="success" dot />
          <Badge label={t('Pending')} tone="warning" dot />
          <Badge label={t('Failed')} tone="danger" dot />
        </Stack>
        <Stack direction="horizontal" gap="md">
          <Input ariaLabel={t('Sample input')} placeholder={t('Search orders')} />
          <Switch ariaLabel={t('Sample switch')} value />
        </Stack>
        <Alert tone="info" title={t('Heads up')} message={t('Semantic tones keep their meaning in both modes')} />
      </Card>
    </div>
  )
}

export function AdminShellThemeRoute(): ReactElement {
  const t = useTranslate()
  const shell = useShell()
  const [primary, setPrimary] = useState('#111111')
  const [brand, setBrand] = useState('#2d5bff')
  const [radius, setRadius] = useState<NonNullable<ThemeConfig['radius']>>('md')
  // The preview shows the app's mode until a preview mode is picked; picking
  // one restyles only the preview.
  const [previewMode, setMode] = useState<'light' | 'dark'>()
  const mode = previewMode ?? shell.colorMode.resolved
  const draft = useMemo(() => ({ mode, primary, brand, radius }), [mode, primary, brand, radius])
  const parsed = useMemo(() => themeConfigSchema.safeParse(draft), [draft])
  const config = parsed.success ? parsed.data : undefined
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Theme & dark mode')}
        description={t('A theme is a small JSON document: seed colours, radius and type scale. Lumi derives every semantic token from it; there is no second palette to maintain')}
      />
      <Card
        title={t('Whole app')}
        description={t('The Shell owns the colour mode preference and persists it')}
        headerEnd={<LumiSegmented ariaLabel={t('App color mode')} value={shell.colorMode.preference} onChange={value => shell.colorMode.set(value as 'light' | 'dark' | 'system')} options={APP_MODE_OPTIONS(t)} />}
      />
      <Card title={t('Theme document')} description={t('Validated by themeConfigSchema, the same check lumi-check runs on theme.json')}>
        <Grid columns={2}>
          <FormField name="primary" label={t('Primary colour')} value={primary} onChange={value => setPrimary(String(value ?? ''))} />
          <FormField name="brand" label={t('Brand colour')}>
            <Stack gap="sm">
              <Input ariaLabel={t('Brand colour')} value={brand} onChange={value => setBrand(String(value ?? ''))} />
              <ColorSwatches ariaLabel={t('Brand presets')} swatches={BRAND_SWATCHES(t)} value={brand} onChange={setBrand} allowCustom />
            </Stack>
          </FormField>
          <FormField name="radius" label={t('Radius')}>
            <LumiSegmented ariaLabel={t('Radius')} value={radius} onChange={value => setRadius(value as NonNullable<ThemeConfig['radius']>)} options={RADIUS_OPTIONS(t)} />
          </FormField>
          <FormField name="previewMode" label={t('Preview mode')}>
            <LumiSegmented ariaLabel={t('Preview mode')} value={mode} onChange={value => setMode(value as 'light' | 'dark')} options={MODE_OPTIONS(t)} />
          </FormField>
        </Grid>
        {!parsed.success && <Alert tone="danger" title={t('Invalid theme')} message={parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')} />}
        <JsonSource label="theme.json" value={draft} />
        {config && <JsonSource label={t('CSS variables (themeToCssVariables)')} value={themeToCssVariables(config)} />}
      </Card>
      {config && <ThemePreview config={config} />}
    </LumiPage>
  )
}
