import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { useChangeLocale, useLocale, useTranslate } from '@duxweb/lumi'
import { useEffect, useId, useRef } from 'react'
import { useAdminColorMode, writeStoredLocale } from '../colorMode.js'
import { ShellChrome, ShellIcon } from './ShellIcon.js'
import { BrandMark, LocaleOptions, moveMenuFocus, ThemeModeSwitch } from './ShellParts.js'

export interface LumiAdminLoginFeature {
  /** A Shell icon name (`shield`, `layout-dashboard`…) or any HugeIcons free icon. */
  icon?: string
  title: string
  /** One line under the title. */
  description?: string
}

/**
 * The brand around every account page — sign-in, sign-up and password
 * recovery — so the four read as one place.
 */
export interface LumiAuthBrandProps {
  /** Product name beside the mark; defaults to the `lumi.admin.title` message. */
  title?: string
  /** Image URL of the mark; without one the mark is the title's initial. */
  logo?: string
  /** A short label above the headline, such as the product line. */
  badge?: string
  /** The headline beside the form (folded away on narrow screens). */
  heroTitle?: string
  /** A phrase of the headline drawn in the brand colour. */
  heroHighlight?: string
  heroDescription?: string
  /** Points listed under the headline, each an icon, a title and a line; pass `[]` to show none. */
  features?: readonly LumiAdminLoginFeature[]
  /** Where a reader who cannot get in finds help, at the top right. */
  help?: { label?: string, linkLabel: string, href: string }
  /** Links at the foot, such as privacy or terms. */
  links?: readonly { label: string, href: string }[]
  /** Defaults to `© <year> <title>`. */
  copyright?: string
  /** Languages offered before sign-in; the switch shows from two up. */
  locales?: readonly { value: string, label: string }[]
  /**
   * The Shell's storage namespace (`lumi:<app id>:shell`). The language chosen
   * here is saved under it, so the Shell opens in the same language.
   */
  storageBase?: string
  /** Moves between the account pages without a reload; links load the page when left out. */
  navigate?: (to: string) => void
}

interface LumiAuthLayoutProps extends LumiAuthBrandProps {
  /** The page's own content: its heading, form and links. */
  children: ReactNode
  testId?: string
}

/** Resolves the brand copy and defaults every account page shares. */
export function useAuthText(): (key: string, fallback: string, params?: Record<string, unknown>) => string {
  const translate = useTranslate()
  return (key, fallback, params) => translate(key, params, fallback)
}

/**
 * The account pages' frame: the brand and display tools along the top, and
 * beside the page's card the host's own copy — badge, headline, description
 * and a short list of points. The card comes first in the document, so keyboard and screen-reader
 * users reach the form straight away.
 */
export function LumiAuthLayout(props: LumiAuthLayoutProps): ReactElement {
  const t = useAuthText()
  const colorMode = useAdminColorMode()
  const ids = useId()
  const heroId = `${ids}-hero`
  const title = props.title ?? t('lumi.admin.title', 'Lumi Admin')
  const heroTitle = props.heroTitle ?? t('lumi.login.heroTitle', 'Management made simple and efficient.')
  const highlight = props.heroHighlight ?? (props.heroTitle === undefined ? t('lumi.login.heroHighlight', 'simple and efficient') : undefined)
  const features = props.features ?? [
    { icon: 'layout-dashboard', title: t('lumi.login.feature1Title', 'Everything at a glance'), description: t('lumi.login.feature1Copy', 'Key figures and to-dos together on one dashboard.') },
    { icon: 'shield', title: t('lumi.login.feature2Title', 'Secure access'), description: t('lumi.login.feature2Copy', 'Roles and permissions decide what each person can see and do.') },
    { icon: 'languages', title: t('lumi.login.feature3Title', 'Works your way'), description: t('lumi.login.feature3Copy', 'Switch language and light or dark mode at any time.') },
  ]
  const copyright = props.copyright ?? `© ${new Date().getFullYear()} ${title}`
  const showLocales = (props.locales?.length ?? 0) > 1

  return (
    <div className="lumi-auth" data-testid={props.testId}>
      <header className="lumi-auth__top">
        <div className="lumi-auth__brand">
          <BrandMark title={title} logo={props.logo} className="lumi-auth__mark" />
          <strong className="lumi-auth__name">{title}</strong>
        </div>
        <div role="group" aria-label={t('lumi.login.preferences', 'Display preferences')} className="lumi-auth__tools">
          {props.help
            ? (
                <span className="lumi-auth__help">
                  {props.help.label ? <span className="lumi-auth__help-label">{props.help.label}</span> : null}
                  <a href={props.help.href}>{props.help.linkLabel}</a>
                </span>
              )
            : null}
          {showLocales ? <AuthLocaleMenu locales={props.locales!} storageBase={props.storageBase} /> : null}
          {colorMode
            ? (
                <ThemeModeSwitch
                  value={colorMode.preference}
                  onChange={colorMode.set}
                  inMenu={false}
                  label={t('lumi.admin.theme', 'Theme')}
                  testIdPrefix="admin-login-theme"
                  className="lumi-auth__theme"
                />
              )
            : null}
        </div>
      </header>

      <div className="lumi-auth__body">
        <main className="lumi-auth__main">
          <div className="lumi-auth__card">{props.children}</div>
        </main>
        <aside className="lumi-auth__hero" aria-labelledby={heroId}>
          {props.badge ? <span className="lumi-auth__badge">{props.badge}</span> : null}
          <h2 id={heroId}><Highlighted text={heroTitle} phrase={highlight} /></h2>
          <p className="lumi-auth__lead">{props.heroDescription ?? t('lumi.login.heroCopy', 'Data, workflows and permissions in one place, so the team’s everyday work stays clear and organised.')}</p>
          {features.length > 0
            ? (
                <ul className="lumi-auth__features" aria-label={t('lumi.login.features', 'Features')}>
                  {features.map(feature => (
                    <li key={feature.title}>
                      <span className="lumi-auth__feature-icon"><ShellIcon name={feature.icon ?? 'tick'} className="size-4" /></span>
                      <span className="lumi-auth__feature-text">
                        <strong>{feature.title}</strong>
                        {feature.description ? <span>{feature.description}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            : null}
        </aside>
      </div>

      <footer className="lumi-auth__foot">
        <div className="lumi-auth__legal">
          <span>{copyright}</span>
          {props.links?.length
            ? (
                <nav aria-label={t('lumi.login.links', 'Related links')} className="lumi-auth__links">
                  {props.links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
                </nav>
              )
            : null}
        </div>
      </footer>
    </div>
  )
}

/** The headline with its highlighted phrase, when the phrase is in it. */
function Highlighted({ text, phrase }: { text: string, phrase: string | undefined }): ReactNode {
  const at = phrase ? text.indexOf(phrase) : -1
  if (!phrase || at < 0)
    return text
  return (
    <>
      {text.slice(0, at)}
      <span className="lumi-auth__highlight">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  )
}

/** A link between account pages: client-side when the host can navigate, a plain link otherwise. */
export function AuthLink({ to, navigate, children, testId, className = 'lumi-auth__link' }: { to: string, navigate?: (to: string) => void, children: ReactNode, testId?: string, className?: string }): ReactElement {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!navigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    navigate(to)
  }
  return <a className={className} href={to} data-testid={testId} onClick={follow}>{children}</a>
}

/** The heading every account card opens with. */
export function AuthHeading({ id, title, description }: { id: string, title: string, description?: string }): ReactElement {
  return (
    <div className="lumi-auth__heading">
      <h1 id={id}>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

/** The language menu in the top bar: the Shell's own options in a small dropdown. */
function AuthLocaleMenu({ locales, storageBase }: { locales: readonly { value: string, label: string }[], storageBase?: string }): ReactElement {
  const translate = useTranslate()
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  const menu = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const current = locales.find(option => option.value === locale)
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

  return (
    <details
      ref={menu}
      className="lumi-auth__menu"
      onKeyDown={(event) => {
        if (event.key !== 'Escape')
          return
        event.preventDefault()
        close(true)
      }}
    >
      <summary
        ref={trigger}
        data-testid="admin-login-locale"
        aria-haspopup="menu"
        aria-label={`${translate('lumi.admin.language', undefined, 'Language')}: ${current?.label ?? locale}`}
        className="lumi-auth__tool"
      >
        <ShellChrome name="languages" className="size-4 shrink-0" />
        <span>{current?.label ?? locale}</span>
        <ShellChrome name="chevron-down" className="lumi-auth__chevron" />
      </summary>
      <div role="menu" className="lumi-glass-panel lumi-auth__menu-panel" onKeyDown={moveMenuFocus}>
        <LocaleOptions
          inMenu
          value={locale}
          options={locales}
          testIdPrefix="admin-login-locale"
          onChange={(value) => {
            close(true)
            if (storageBase !== undefined)
              writeStoredLocale(storageBase, value)
            void changeLocale(value)
          }}
        />
      </div>
    </details>
  )
}
