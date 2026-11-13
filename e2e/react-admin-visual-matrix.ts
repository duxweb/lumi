// Single source of the React Admin visual matrix. The e2e spec iterates it and
// scripts/verify-visual-assets.mjs derives the expected baseline files from it,
// so the committed snapshots can never drift from what the spec captures.

export const visualViewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const [desktop, mobile] = visualViewports

/**
 * The viewport and colour mode pairs the spec runs: both modes on desktop,
 * light on a phone. Tablet sits between the two and dark mode is the same
 * layout, so neither adds a failure the others miss.
 */
export const visualRuns = [
  { viewport: desktop, mode: 'light' },
  { viewport: desktop, mode: 'dark' },
  { viewport: mobile, mode: 'light' },
] as const

export const visualPages = [
  ['dashboard', '/', 'Operations overview'],
  ['workbench', '/workbench', 'Good evening, Ada'],
  ['list', '/products', 'Products'],
  ['form', '/products/new', 'Create product'],
  ['detail', '/products/1', 'Lumi Product 1'],
  ['settings', '/settings/profile', 'Settings'],
  ['ui-overview', '/ui/overview', 'Component overview'],
  ['ui-form-elements', '/forms/elements', 'Form elements'],
  ['ui-tables', '/ui/tables', 'Tables'],
  ['ui-cards', '/ui/cards', 'Cards'],
  ['publish', '/articles/new', 'Write article'],
  ['tabs', '/projects/new', 'New project'],
  ['order-detail', '/orders/1', 'ORD-00001'],
  ['ui-buttons', '/ui/buttons', 'Buttons'],
  ['drawerform', '/customers?drawer=edit-customer&record=1', 'Edit customer'],
  ['drawertable', '/customers?drawer=customer-orders&record=1', 'Orders · Northwind Studio'],
  ['cards', '/projects/cards', 'Project cards'],
  ['search', '/articles/search', 'Search articles'],
  ['modal', '/articles', 'Articles'],
] as const

/** Settings tabs captured after the Settings page itself. */
export const settingsSections = ['Notifications', 'Preferences', 'Security'] as const

/**
 * Every page is captured on desktop. Mobile baselines are kept only
 * for the layouts whose responsive behaviour differs materially: the shell
 * workbench, dashboard grid, list, form and settings. Accessibility scans still
 * run on every page at every viewport and mode.
 */
const responsivePages: ReadonlySet<string> = new Set(['dashboard', 'workbench', 'list', 'form', 'settings'])

export function capturesVisual(page: string, viewport: string): boolean {
  return viewport === 'desktop' || responsivePages.has(page)
}

/** Settings tab screenshots are desktop-only; the tab layout reuses the Settings frame. */
export function capturesSettingsSection(viewport: string): boolean {
  return viewport === 'desktop'
}

export function visualSnapshotName(page: string, viewport: string, mode: string): string {
  return `${page}-${viewport}-${mode}.png`
}

/** All screenshot names (Playwright `{arg}{ext}`) the spec produces, platform suffix excluded. */
export function visualSnapshotNames(): string[] {
  const names: string[] = []
  for (const { viewport, mode } of visualRuns) {
    for (const [page] of visualPages) {
      if (capturesVisual(page, viewport.name))
        names.push(visualSnapshotName(page, viewport.name, mode))
      if (page === 'settings' && capturesSettingsSection(viewport.name)) {
        for (const section of settingsSections)
          names.push(visualSnapshotName(`settings-${section.toLowerCase()}`, viewport.name, mode))
      }
    }
  }
  return names.sort()
}
