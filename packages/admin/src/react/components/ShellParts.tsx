import type {
  ReactElement,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from 'react'
import type {
  LumiAdminMenuGroup,
  LumiAdminMenuItem,
  LumiAdminModule,
  ShellColorModePreference,
} from '../types.js'
import type { ShellChromeIcon } from './ShellIcon.js'
import { useLocale, useTranslate } from '@duxweb/lumi'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAdminDrawerOptional } from '../routedDrawer.js'
import {
  useShell,
  useShellAssistant,
  useShellEventEmitter,
  useShellHeaderEnd,
  useShellMenuBadge,
  useShellMobileTrigger,
} from './ShellContext.js'
import { ShellChrome, ShellIcon } from './ShellIcon.js'

const MOBILE_NAVIGATION_ID = 'lumi-admin-mobile-navigation'
const TAB_TEST_ID_RE = /[^\w-]+/g

export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}

export function useShellText(): (value: LumiAdminMenuItem['label']) => string {
  return value => value
}

export function useFilteredGroups(
  groups: readonly LumiAdminMenuGroup[],
): LumiAdminMenuGroup[] {
  const shell = useShell()
  const locale = useLocale()
  const text = useShellText()
  const normalized = shell.navigation.query.trim().toLocaleLowerCase(locale)
  return useMemo(
    () =>
      groups
        .map(group => ({
          ...group,
          items: group.items.filter(
            item =>
              !normalized
              || `${text(item.label)} ${item.path}`
                .toLocaleLowerCase(locale)
                .includes(normalized),
          ),
        }))
        .filter(group => group.items.length > 0),
    [groups, locale, normalized, text],
  )
}

/**
 * The app or workspace mark: the logo image when there is one, otherwise the
 * title's initial on the info colour (`.lumi-brand-mark`). Decorative — the
 * name is always written beside it or carried by the control around it.
 */
export function BrandMark({ title, logo, className }: { title: string, logo?: string | undefined, className?: string }): ReactElement {
  return logo
    ? <img src={logo} alt="" className={cx('shrink-0 object-contain', className)} />
    : <span aria-hidden className={cx('lumi-brand-mark', className)}>{title.slice(0, 1).toUpperCase()}</span>
}

export function ShellBrand({ className }: { className: string }): ReactNode {
  const { app } = useShell()
  return <BrandMark title={app.title} logo={app.logo} className={className} />
}

export function ShellAvatar({ className }: { className: string }): ReactNode {
  const shell = useShell()
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-sidebar-accent font-semibold text-foreground',
        className,
      )}
    >
      {(shell.identity.value?.name ?? 'U').slice(0, 1).toUpperCase()}
    </span>
  )
}

/** An icon-only button of the shell's header; `label` is its accessible name. */
export function ShellIconButton(props: {
  icon: ShellChromeIcon
  label: string
  onClick: () => void
  testId?: string
  state?: string
  className?: string
  disabled?: boolean
  /** A toggle that is on reads in the info colour, as the design's `.ibtn.on`. */
  pressed?: boolean
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      data-testid={props.testId}
      data-state={props.state}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      className={cx(
        'lumi-shell-icon-button inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.className,
      )}
      onClick={props.onClick}
    >
      <ShellChrome name={props.icon} className="size-4" />
    </button>
  )
}

export function ShellThemeToggle({
  testId,
}: {
  testId?: string
}): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const next
    = shell.colorMode.preference === 'light'
      ? 'dark'
      : shell.colorMode.preference === 'dark'
        ? 'system'
        : 'light'
  return (
    <ShellIconButton
      icon={
        shell.colorMode.preference === 'system'
          ? 'monitor'
          : shell.colorMode.preference === 'dark'
            ? 'moon'
            : 'sun'
      }
      label={translate('lumi.admin.toggleTheme', undefined, 'Toggle theme')}
      onClick={() => shell.colorMode.set(next)}
      testId={testId}
      state={shell.colorMode.preference}
    />
  )
}

/**
 * The header's trailing edge. Manifest header actions render first — the shell
 * owns the button and hands each click to the routed drawer, the router, or
 * the runtime event emitter, so the manifest stays declarative — then the
 * shell's single-button theme cycle, then the host's `headerEnd` slot for chrome
 * the shell cannot supply the feature for.
 */
export function ShellHeaderEnd({ theme = true }: { theme?: boolean } = {}): ReactNode {
  const shell = useShell()
  const emit = useShellEventEmitter()
  const drawer = useAdminDrawerOptional()
  const content = useShellHeaderEnd()
  const translate = useTranslate()
  const actions = shell.app.header?.actions ?? []
  return (
    <div className="flex shrink-0 items-center gap-1">
      {actions.map((action) => {
        const label = action.labelKey ? translate(action.labelKey, undefined, action.label) : action.label
        return (
          <button
            key={action.name}
            type="button"
            data-testid={`admin-header-${action.name}`}
            aria-label={label}
            title={label}
            className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              if (action.drawer)
                drawer?.open(action.drawer)
              if (action.href)
                shell.navigation.navigate(action.href)
              if (action.event)
                void emit?.({ name: action.event, payload: {} })
            }}
          >
            <ShellIcon name={action.icon} className="size-4" />
          </button>
        )
      })}
      {theme ? <ShellThemeToggle testId="admin-header-theme" /> : null}
      {content}
    </div>
  )
}

export function ShellSearch({
  className,
  shortcut = false,
  minWidth,
}: {
  className: string
  shortcut?: boolean
  minWidth: 768 | 1200
}): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!shortcut)
      return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey)
        || event.key.toLocaleLowerCase() !== 'k'
      ) {
        return
      }
      if (
        typeof window.matchMedia !== 'function'
        || !window.matchMedia(`(min-width: ${minWidth}px)`).matches
      ) {
        return
      }
      event.preventDefault()
      input.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [minWidth, shortcut])

  return (
    <label className={className}>
      <ShellChrome
        name="search"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        ref={input}
        data-testid="admin-menu-search"
        value={shell.navigation.query}
        // `bg-inherit` rather than the transparent-background utility: this
        // package ships its own Tailwind build, so a base utility it emits
        // lands after the adapter's sheet and would beat the adapter's own
        // `dark:bg-input/30` on every `[data-slot="input"]`.
        className="min-w-0 flex-1 border-0 bg-inherit text-label text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={translate(
          'lumi.admin.search',
          undefined,
          'Search navigation...',
        )}
        aria-label={translate(
          'lumi.admin.search',
          undefined,
          'Search navigation...',
        )}
        onChange={event => shell.navigation.setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            shell.navigation.setQuery('')
            event.preventDefault()
          }
        }}
      />
      {shortcut
        ? (
            <kbd className="shrink-0 rounded-sm border border-border px-[5px] py-[3px] text-caption font-medium leading-none text-[color:var(--lumi-fg-secondary)]">
              ⌘K
            </kbd>
          )
        : null}
    </label>
  )
}

/**
 * The sidebar head: the current workspace with its mark, name and description.
 * With two or more `app.workspaces` it opens a menu to switch between them;
 * otherwise it shows the app title and subtitle.
 */
export function ShellWorkspace(): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const menu = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const current = shell.workspace.current
  const label = current?.label ?? shell.app.title
  const description = current ? current.description : shell.app.subtitle
  const logo = current?.logo ?? shell.app.logo
  const switchable = shell.workspace.options.length > 1

  useEffect(() => {
    if (!switchable)
      return
    const onPointerDown = (event: PointerEvent): void => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.removeAttribute('open')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [switchable])

  const mark = (item: { label: string, logo?: string | undefined }, size: string): ReactNode => item.logo
    ? <img src={item.logo} alt="" className={cx('shrink-0 rounded-lg object-cover', size)} />
    : <BrandMark title={item.label} className={cx('rounded-lg text-label', size)} />
  const body = (
    <>
      {mark({ label, logo }, 'size-7')}
      <span className="min-w-0 flex-1 text-left">
        <strong className="block truncate text-body leading-tight font-semibold">{label}</strong>
        {description ? <small className="block truncate text-caption leading-snug text-muted-foreground">{description}</small> : null}
      </span>
    </>
  )
  if (!switchable)
    return <div data-testid="admin-workspace" className="lumi-shell-workspace-head flex h-11 w-full min-w-0 items-center gap-2.5 rounded-lg px-2">{body}</div>

  const close = (restoreFocus: boolean): void => {
    menu.current?.removeAttribute('open')
    if (restoreFocus)
      trigger.current?.focus()
  }
  return (
    <details
      ref={menu}
      className="relative w-full min-w-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape')
          return
        event.preventDefault()
        close(true)
      }}
    >
      <summary
        ref={trigger}
        data-testid="admin-workspace"
        aria-haspopup="menu"
        aria-label={translate('lumi.admin.switchWorkspace', { name: label }, 'Switch workspace, current: {name}')}
        className="lumi-shell-workspace-head flex h-11 w-full min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        {body}
        <ShellChrome name="chevrons-up-down" className="size-4 shrink-0 text-muted-foreground" />
      </summary>
      <div role="menu" className="lumi-glass-panel absolute inset-x-0 top-full z-(--lumi-z-popover) mt-1 rounded-md p-1 text-popover-foreground" onKeyDown={moveMenuFocus}>
        {shell.workspace.options.map((option) => {
          const selected = option.value === current?.value
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              data-testid={`admin-workspace-${option.value}`}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-sm px-2 text-left text-label hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => {
                close(true)
                if (!selected)
                  shell.workspace.select(option.value)
              }}
            >
              {mark(option, 'size-6')}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{option.label}</span>
                {option.description ? <span className="block truncate text-caption text-muted-foreground">{option.description}</span> : null}
              </span>
              {selected ? <ShellChrome name="check" className="size-4 shrink-0 text-[color:var(--lumi-text-info)]" /> : null}
            </button>
          )
        })}
      </div>
    </details>
  )
}

/** The menu search atop the sidebar, when `app.search` is `sidebar`. */
export function ShellSidebarSearch({ minWidth }: { minWidth: 768 | 1200 }): ReactElement {
  return <ShellSearch className="lumi-shell-header-search lumi-shell-sidebar-search" shortcut minWidth={minWidth} />
}

/** Roving focus for the `<details>` menus the shell opens from its own chrome. */
export function moveMenuFocus(event: ReactKeyboardEvent<HTMLElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
    return
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"], [role="menuitemradio"]',
    ),
  )
  if (items.length === 0)
    return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  const next
    = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length
  items[next]?.focus()
}

const THEME_MODES = [
  {
    value: 'light',
    icon: 'sun',
    key: 'lumi.admin.themeLight',
    fallback: 'Light',
  },
  {
    value: 'dark',
    icon: 'moon',
    key: 'lumi.admin.themeDark',
    fallback: 'Dark',
  },
  {
    value: 'system',
    icon: 'monitor',
    key: 'lumi.admin.themeSystem',
    fallback: 'System',
  },
] as const

/**
 * Light, dark and system as one segmented track. Inside a menu the segments
 * are `menuitemradio`s; standing alone (the sign-in page) they are a radio
 * group with arrow-key selection and a single tab stop.
 */
export function ThemeModeSwitch({
  value,
  onChange,
  inMenu = true,
  labelId,
  label,
  testIdPrefix = 'admin-theme',
  className,
}: {
  value: ShellColorModePreference
  onChange: (value: ShellColorModePreference) => void
  inMenu?: boolean
  labelId?: string
  label?: string
  testIdPrefix?: string
  className?: string
}): ReactElement {
  const translate = useTranslate()
  const select = (index: number, element: HTMLElement): void => {
    const mode = THEME_MODES[(index + THEME_MODES.length) % THEME_MODES.length]!
    onChange(mode.value)
    element.querySelector<HTMLElement>(`[data-value="${mode.value}"]`)?.focus()
  }
  return (
    <div
      role={inMenu ? 'group' : 'radiogroup'}
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : label}
      className={cx(
        'inline-flex h-7 shrink-0 items-center rounded-lg bg-muted p-[3px]',
        className,
      )}
      onKeyDown={inMenu
        ? undefined
        : (event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
            if (step === undefined)
              return
            event.preventDefault()
            select(THEME_MODES.findIndex(mode => mode.value === value) + step, event.currentTarget)
          }}
    >
      {THEME_MODES.map(mode => (
        <button
          key={mode.value}
          type="button"
          role={inMenu ? 'menuitemradio' : 'radio'}
          data-value={mode.value}
          data-testid={`${testIdPrefix}-${mode.value}`}
          aria-checked={value === mode.value}
          aria-label={translate(mode.key, undefined, mode.fallback)}
          title={translate(mode.key, undefined, mode.fallback)}
          tabIndex={inMenu || value === mode.value ? undefined : -1}
          className={cx(
            'grid h-full w-8 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === mode.value
              ? 'bg-background text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)] dark:bg-[oklch(1_0_0/6%)] dark:shadow-none'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(mode.value)}
        >
          <ShellChrome name={mode.icon} className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

/**
 * The account menu allows direct selection; the separate header control cycles
 * through the same light, dark, and system preferences with one button.
 */
export function ShellThemeSwitch({
  labelId,
  onSelect,
  className,
}: {
  labelId?: string
  onSelect?: () => void
  className?: string
}): ReactElement {
  const shell = useShell()
  return (
    <ThemeModeSwitch
      value={shell.colorMode.preference}
      labelId={labelId}
      className={className}
      onChange={(value) => {
        shell.colorMode.set(value)
        onSelect?.()
      }}
    />
  )
}

/**
 * Languages one row each, the current one checked: `menuitemradio`s inside a
 * menu, otherwise a radio group.
 */
export function LocaleOptions({
  value,
  options,
  onChange,
  inMenu = false,
  testIdPrefix = 'admin-locale',
  className,
}: {
  value: string
  options: readonly { value: string, label: string }[]
  onChange: (value: string) => void
  inMenu?: boolean
  testIdPrefix?: string
  className?: string
}): ReactElement {
  const translate = useTranslate()
  const labelId = useId()
  return (
    <div role={inMenu ? 'group' : 'radiogroup'} aria-labelledby={labelId} className={className}>
      <span id={labelId} className="block px-2.5 py-1 text-caption text-muted-foreground">
        {translate('lumi.admin.language', undefined, 'Language')}
      </span>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role={inMenu ? 'menuitemradio' : 'radio'}
          lang={option.value}
          data-testid={`${testIdPrefix}-${option.value}`}
          aria-checked={value === option.value}
          className="flex min-h-8 w-full items-center justify-between gap-2 rounded-sm px-2.5 text-left text-label hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {value === option.value
            ? <ShellChrome name="check" className="size-3.5 shrink-0" />
            : null}
        </button>
      ))}
    </div>
  )
}

/**
 * The languages the app offers, one row each with the current one checked.
 * Absent until the manifest lists at least two.
 */
export function ShellLocaleOptions({ inMenu = false, onSelect, className }: { inMenu?: boolean, onSelect?: () => void, className?: string }): ReactNode {
  const shell = useShell()
  if (shell.locale.options.length < 2)
    return null
  return (
    <LocaleOptions
      value={shell.locale.value}
      options={shell.locale.options}
      inMenu={inMenu}
      className={className}
      onChange={(value) => {
        shell.locale.set(value)
        onSelect?.()
      }}
    />
  )
}

/**
 * The desktop account entry follows the header theme switch. Identity details,
 * the same theme choices, and sign-out remain available inside its menu.
 */
export function ShellAccountMenu({
  placement = 'header',
}: {
  /** `rail` opens the menu beside the rail's foot instead of below the header. */
  placement?: 'header' | 'rail'
} = {}): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const menu = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const close = (restoreFocus: boolean): void => {
    menu.current?.removeAttribute('open')
    if (restoreFocus)
      trigger.current?.focus()
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.removeAttribute('open')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const name
    = shell.identity.value?.name
      ?? translate('lumi.admin.user', undefined, 'User')
  const themeLabelId = useId()
  return (
    <details
      ref={menu}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape')
          return
        event.preventDefault()
        close(true)
      }}
    >
      <summary
        ref={trigger}
        data-testid="admin-account"
        aria-label={translate('lumi.admin.account', undefined, 'Account')}
        aria-haspopup="menu"
        className="grid size-7 cursor-pointer list-none place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <ShellAvatar className="size-7 text-caption" />
      </summary>
      <div
        role="menu"
        className={cx(
          'lumi-glass-panel absolute z-(--lumi-z-popover) w-60 rounded-md p-1 text-popover-foreground',
          placement === 'rail' ? 'bottom-0 left-full ml-2' : 'right-0 top-full mt-1',
        )}
        onKeyDown={moveMenuFocus}
      >
        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          <span
            data-testid="admin-user"
            className="truncate text-label font-medium text-foreground"
          >
            {name}
          </span>
          {shell.identity.value?.email
            ? (
                <span className="truncate text-caption text-muted-foreground">
                  {shell.identity.value.email}
                </span>
              )
            : null}
        </div>
        <div className="my-1 h-px bg-border" aria-hidden />
        {/* Three modes, one row, one shared control. */}
        <div className="flex items-center gap-2 px-2 py-1 text-label">
          <span id={themeLabelId}>
            {translate('lumi.admin.theme', undefined, 'Theme')}
          </span>
          <ShellThemeSwitch
            labelId={themeLabelId}
            className="ml-auto"
            onSelect={() => close(true)}
          />
        </div>
        {shell.locale.options.length > 1
          ? (
              <>
                <div className="my-1 h-px bg-border" aria-hidden />
                <ShellLocaleOptions inMenu onSelect={() => close(true)} />
              </>
            )
          : null}
        {shell.auth.available
          ? (
              <>
                <div className="my-1 h-px bg-border" aria-hidden />
                <button
                  type="button"
                  role="menuitem"
                  data-testid="admin-logout"
                  disabled={shell.auth.pending}
                  className="flex min-h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-label hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    close(false)
                    void shell.auth.logout()
                  }}
                >
                  <ShellChrome
                    name="log-out"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  {translate('lumi.admin.logout', undefined, 'Logout')}
                </button>
              </>
            )
          : null}
      </div>
    </details>
  )
}

export function ShellNavLink({
  item,
  surface = 'sidebar',
}: {
  item: LumiAdminMenuItem
  surface?: 'sidebar' | 'main'
}): ReactElement {
  const shell = useShell()
  const text = useShellText()
  const active = shell.active.item?.path === item.path
  const badge = useShellMenuBadge(item.name)
  return (
    <Link
      to={item.path}
      data-testid={`nav-${item.name}`}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'lumi-shell-nav-link flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        surface === 'main'
          ? active
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
          : active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-[color:var(--lumi-fg-secondary)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      onClick={(event) => {
        event.preventDefault()
        shell.navigation.navigate(item.path)
      }}
    >
      <ShellIcon
        name={item.icon}
        className={cx(
          'size-4 shrink-0',
          active ? 'text-foreground' : 'text-[color:var(--lumi-fg-secondary)]',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{text(item.label)}</span>
      {badge
        ? <span data-slot="menu-badge" data-tone={badge.tone ?? 'neutral'}>{badge.label}</span>
        : null}
    </Link>
  )
}

export function ShellMenuGroup({
  group,
  panel = false,
  collapsible = false,
  surface = 'sidebar',
}: {
  group: LumiAdminMenuGroup
  panel?: boolean
  collapsible?: boolean
  surface?: 'sidebar' | 'main'
}): ReactElement {
  const shell = useShell()
  const text = useShellText()
  const contentId = useId()
  const [expanded, setExpanded] = useState(true)
  const searching = shell.navigation.query.trim().length > 0

  useEffect(() => {
    if (searching)
      setExpanded(true)
  }, [searching])

  return (
    <div className={cx('space-y-0.5', panel && 'lumi-shell-menu-group')}>
      {collapsible
        ? (
            <button
              type="button"
              data-testid={`admin-menu-group-${group.name}`}
              aria-controls={contentId}
              aria-expanded={expanded}
              className={cx(
                'group/menu-group flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-left text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                surface === 'main' ? 'hover:bg-accent' : 'hover:bg-sidebar-accent',
              )}
              onClick={() => setExpanded(value => !value)}
            >
              <span className="min-w-0 flex-1 truncate">{text(group.label)}</span>
              <ShellChrome
                name="chevron-right"
                className={cx(
                  'size-3.5 shrink-0 opacity-0 transition group-hover/menu-group:opacity-100 group-focus-visible/menu-group:opacity-100',
                  expanded ? 'rotate-90' : 'opacity-100',
                )}
              />
            </button>
          )
        : (
            <div className="flex h-7 items-center px-2.5 text-caption text-muted-foreground">
              {text(group.label)}
            </div>
          )}
      <div
        id={contentId}
        hidden={collapsible && !expanded}
        className="space-y-0.5"
      >
        {group.items.map(item => (
          <ShellNavLink key={item.path} item={item} surface={surface} />
        ))}
      </div>
    </div>
  )
}

export function ShellNoResults(): ReactNode {
  const shell = useShell()
  const translate = useTranslate()
  return shell.navigation.query.trim()
    ? (
        <p
          role="status"
          className="px-3 py-6 text-center text-label text-muted-foreground"
        >
          {translate(
            'lumi.admin.noSearchResults',
            undefined,
            'No matching navigation items',
          )}
        </p>
      )
    : null
}

export function ShellTabs(): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const list = useRef<HTMLElement>(null)
  const overflow = useRef<HTMLDetailsElement>(null)
  const overflowTrigger = useRef<HTMLElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const element = list.current
    if (!element)
      return
    const update = (): void =>
      setOverflowing(element.scrollWidth > element.clientWidth)
    update()
    const observer
      = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update)
    observer?.observe(element)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [shell.tabs.items])

  if (!shell.tabs.enabled)
    return <div data-testid="admin-tabs" className="hidden" />
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {/* Line tabs: the strip already carries a rule, so the active tab claims a
          segment of it instead of stacking a second surface on the chrome. */}
      <nav
        ref={list}
        data-testid="admin-tabs"
        aria-label={translate('lumi.admin.tabs', undefined, 'Open pages')}
        className="-mb-px flex h-10 w-fit min-w-0 max-w-full items-stretch gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shell.tabs.items.map((tab) => {
          const active = shell.tabs.activeKey === tab.key
          return (
            <div
              key={tab.key}
              className={cx(
                'group/tab relative inline-flex shrink-0 items-center gap-1 border-b-2 text-label transition-colors',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Link
                to={tab.path}
                data-active={active || undefined}
                className="inline-flex h-full max-w-48 items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={(event) => {
                  event.preventDefault()
                  shell.tabs.activate(tab.key)
                }}
              >
                {!tab.closable
                  ? (
                      <ShellChrome name="home" className="size-3.5" />
                    )
                  : null}
                <span className="truncate">{tab.label}</span>
              </Link>
              {/* The close affordance stays visible: a tab strip is a working
                  set, and hiding the way to shrink it costs a hover to find. */}
              {tab.closable
                ? (
                    <button
                      type="button"
                      data-testid={`admin-tab-close-${tab.key.replace(TAB_TEST_ID_RE, '-')}`}
                      aria-label={translate(
                        'lumi.admin.closeTab',
                        { label: tab.label },
                        'Close {label}',
                      )}
                      className="grid size-4.5 place-items-center rounded-sm text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => shell.tabs.close(tab.key)}
                    >
                      <ShellChrome name="x" className="size-3.5" />
                    </button>
                  )
                : null}
            </div>
          )
        })}
      </nav>
      {overflowing
        ? (
            <details
              ref={overflow}
              className="relative shrink-0"
              onKeyDown={(event) => {
                if (event.key !== 'Escape')
                  return
                event.preventDefault()
                overflow.current?.removeAttribute('open')
                overflowTrigger.current?.focus()
              }}
            >
              <summary
                ref={overflowTrigger}
                data-testid="admin-tabs-overflow"
                aria-label={translate(
                  'lumi.admin.openTabsMenu',
                  undefined,
                  'Open pages menu',
                )}
                aria-haspopup="menu"
                className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
              >
                <ShellChrome name="ellipsis" className="size-4" />
              </summary>
              <div
                role="menu"
                data-testid="admin-tabs-overflow-menu"
                className="lumi-glass-panel absolute right-0 top-full z-(--lumi-z-popover) mt-1 min-w-48 rounded-md p-1 text-popover-foreground"
                onKeyDown={moveMenuFocus}
              >
                {shell.tabs.items.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    role="menuitem"
                    aria-current={
                      shell.tabs.activeKey === tab.key ? 'page' : undefined
                    }
                    className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2.5 text-left text-label hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      overflow.current?.removeAttribute('open')
                      shell.tabs.activate(tab.key)
                    }}
                  >
                    {shell.tabs.activeKey === tab.key
                      ? (
                          <ShellChrome name="check" className="size-3.5" />
                        )
                      : (
                          <span className="size-3.5" aria-hidden />
                        )}
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </details>
          )
        : null}
    </div>
  )
}

export function ShellMobileButton({
  layout,
}: {
  layout: 'single' | 'dual'
}): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const setTrigger = useShellMobileTrigger()
  return (
    <button
      ref={setTrigger}
      type="button"
      data-layout={layout}
      data-testid="admin-mobile-navigation-trigger"
      aria-label={translate(
        'lumi.admin.openNavigation',
        undefined,
        'Open navigation',
      )}
      aria-controls={MOBILE_NAVIGATION_ID}
      aria-expanded={shell.navigation.mobileOpen}
      className="lumi-shell-mobile-trigger grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={shell.navigation.openMobile}
    >
      <ShellChrome name="menu" className="size-4.5" />
    </button>
  )
}

export function ShellMobileNavigation(): ReactNode {
  const shell = useShell()
  const translate = useTranslate()
  const groups = useFilteredGroups(shell.groups)
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const { closeMobile, mobileOpen } = shell.navigation

  useEffect(() => {
    if (!mobileOpen)
      return
    close.current?.focus()
    const shellRoot = panel.current?.closest<HTMLElement>('[data-lumi-shell]')
    const overlay = panel.current?.parentElement
    const isolated = shellRoot
      ? Array.from(shellRoot.children)
          .filter(element => element !== overlay)
          .map((element) => {
            const node = element as HTMLElement
            const previous = {
              inert: node.inert,
              ariaHidden: node.getAttribute('aria-hidden'),
            }
            node.inert = true
            node.setAttribute('aria-hidden', 'true')
            return { node, previous }
          })
      : []
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobile()
        return
      }
      if (event.key !== 'Tab')
        return
      const focusable = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last)
        return
      if (!panel.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus()
      }
      else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      isolated.forEach(({ node, previous }) => {
        node.inert = previous.inert
        if (previous.ariaHidden === null)
          node.removeAttribute('aria-hidden')
        else node.setAttribute('aria-hidden', previous.ariaHidden)
      })
    }
  }, [closeMobile, mobileOpen])

  if (!mobileOpen)
    return null
  return (
    <div
      data-testid="admin-mobile-navigation"
      className="lumi-shell-mobile-navigation fixed inset-0 z-(--lumi-z-overlay)"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 size-full bg-black/45"
        onClick={closeMobile}
      />
      <div
        ref={panel}
        id={MOBILE_NAVIGATION_ID}
        role="dialog"
        aria-modal="true"
        aria-label={translate('lumi.admin.navigation', undefined, 'Navigation')}
        className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-sidebar-border bg-sidebar p-3 text-foreground shadow-[var(--shadow-overlay)]"
      >
        <div className="mb-4 flex min-h-11 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ShellBrand className="size-9 rounded-xl" />
            <strong className="truncate">{shell.app.title}</strong>
          </div>
          <button
            ref={close}
            type="button"
            aria-label={translate(
              'lumi.admin.closeNavigation',
              undefined,
              'Close navigation',
            )}
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={closeMobile}
          >
            <ShellChrome name="x" className="size-4.5" />
          </button>
        </div>
        <ShellSearch
          className="mb-4 flex h-10 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring"
          minWidth={768}
        />
        <nav className="flex-1 space-y-4 overflow-y-auto">
          {groups.map(group => (
            <ShellMenuGroup key={group.name} group={group} />
          ))}
          <ShellNoResults />
        </nav>
        {shell.auth.error
          ? (
              <p role="alert" className="mt-2 text-caption text-destructive">
                {translate(
                  'lumi.admin.authError',
                  undefined,
                  'Session unavailable',
                )}
              </p>
            )
          : null}
        {shell.locale.options.length > 1
          ? <ShellLocaleOptions className="mt-3 shrink-0 border-t border-border pt-2" />
          : null}
        <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border pt-3">
          <ShellAvatar className="size-9 text-label" />
          <span
            data-testid="admin-mobile-user"
            className="min-w-0 flex-1 truncate text-label font-medium"
          >
            {shell.identity.value?.name
              ?? translate('lumi.admin.user', undefined, 'User')}
          </span>
          <ShellThemeToggle />
          {shell.auth.available
            ? (
                <ShellIconButton
                  icon="log-out"
                  label={translate('lumi.admin.logout', undefined, 'Logout')}
                  onClick={() => void shell.auth.logout()}
                  testId="admin-mobile-logout"
                  disabled={shell.auth.pending}
                />
              )
            : null}
        </div>
      </div>
    </div>
  )
}

export function ShellModuleEntry({
  module,
}: {
  module: LumiAdminModule
}): ReactElement {
  const shell = useShell()
  const text = useShellText()
  const active = shell.active.module?.name === module.name
  const first = module.groups[0]?.items[0]
  return (
    <Link
      to={first?.path ?? '/'}
      data-testid={`module-${module.name}`}
      title={text(module.label)}
      aria-label={text(module.label)}
      data-active={active || undefined}
      className="lumi-shell-module relative mx-auto grid size-8 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => {
        event.preventDefault()
        shell.navigation.navigate(first?.path ?? '/')
      }}
    >
      <ShellIcon
        name={module.icon}
        className="size-4"
        fallback={<ShellChrome name="folder" className="size-4" />}
      />
    </Link>
  )
}

/** Separates page tools from the assistant toggle; absent with the toggle. */
export function ShellAssistantDivider(): ReactNode {
  const shell = useShell()
  if (!shell.assistant.available)
    return null
  return <span aria-hidden className="lumi-shell-assistant-toggle mx-1.5 h-[18px] w-px bg-border" />
}

/** Header control for the host's assistant panel; absent when the host supplies none. */
export function ShellAssistantToggle(): ReactNode {
  const shell = useShell()
  const translate = useTranslate()
  if (!shell.assistant.available)
    return null
  const label = shell.assistant.open
    ? translate('lumi.admin.hideAssistant', undefined, 'Hide assistant')
    : translate('lumi.admin.showAssistant', undefined, 'Show assistant')
  return (
    <ShellIconButton
      icon="panel-right"
      label={label}
      testId="admin-assistant-toggle"
      state={shell.assistant.open ? 'open' : 'closed'}
      pressed={shell.assistant.open}
      className="lumi-shell-assistant-toggle"
      onClick={shell.assistant.toggle}
    />
  )
}

/** The frame beside the page. Its content belongs to the host. */
export function ShellAssistantPanel(): ReactNode {
  const shell = useShell()
  const translate = useTranslate()
  const content = useShellAssistant()
  if (!shell.assistant.open)
    return null
  return (
    <aside
      data-testid="admin-assistant"
      aria-label={translate('lumi.admin.assistant', undefined, 'Assistant')}
      className="lumi-shell-surface lumi-shell-assistant w-[min(24rem,32vw)] shrink-0 flex-col overflow-clip"
    >
      {content}
    </aside>
  )
}

const HASH_SETTLE_MS = 1500
const HASH_WAIT_MS = 10_000

/**
 * Brings the element named by `location.hash` to the top of main by scrolling main alone. The
 * target may render after the page loads, and content above it may still arrive, so it keeps the
 * target aligned briefly until the reader scrolls.
 */
function useHashTarget(main: RefObject<HTMLElement | null>): void {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // A fragment that is not valid percent-encoding (`#100%`) is read as written.
    let id = hash.slice(1)
    try {
      id = decodeURIComponent(id)
    }
    catch {}
    if (!main.current || !id)
      return
    const scroller: HTMLElement = main.current
    const document = scroller.ownerDocument
    const view = document.defaultView ?? window
    const interactions = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    let settleUntil = 0
    function reveal(): boolean {
      const target = document.getElementById(id)
      if (!target || !scroller.contains(target))
        return false
      const margin = Number.parseFloat(view.getComputedStyle(target).scrollMarginTop) || Number.parseFloat(view.getComputedStyle(document.documentElement).fontSize)
      scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin })
      return true
    }
    const observer = new MutationObserver(() => {
      if (settleUntil && Date.now() > settleUntil)
        return stop()
      if (reveal() && !settleUntil)
        settleUntil = Date.now() + HASH_SETTLE_MS
    })
    const timeout = view.setTimeout(stop, HASH_WAIT_MS)
    function stop(): void {
      observer.disconnect()
      view.clearTimeout(timeout)
      for (const type of interactions)
        scroller.removeEventListener(type, stop)
    }
    if (reveal())
      settleUntil = Date.now() + HASH_SETTLE_MS
    observer.observe(scroller, { childList: true, subtree: true })
    for (const type of interactions)
      scroller.addEventListener(type, stop, { passive: true })
    return stop
  }, [pathname, hash, main])
}

export function ShellMain({ children }: { children: ReactNode }): ReactElement {
  const main = useRef<HTMLElement>(null)
  useHashTarget(main)
  return (
    <main
      ref={main}
      data-lumi-shell-main
      tabIndex={0}
      className="min-h-0 min-w-0 flex-1 overflow-auto bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {children}
    </main>
  )
}
