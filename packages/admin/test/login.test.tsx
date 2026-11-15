// @vitest-environment jsdom
import type { AuthProvider, ToastParams, ToastProvider } from '@duxweb/lumi'
import type { ReactElement } from 'react'
import type { LumiAdminLoginProps } from '../src/react/components/LumiAdminLogin.js'
import { createI18nProvider, createLumi, LumiProvider } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminI18nProvider } from '../src/catalog.js'
import { AdminColorModeProvider } from '../src/react/colorMode.js'
import { LumiAdminLogin } from '../src/react/components/LumiAdminLogin.js'

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE = 'lumi:login-test:shell'
const LOCALES = [{ value: 'en-US', label: 'English' }, { value: 'zh-CN', label: '简体中文' }]

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function setup(options: { login?: AuthProvider['login'], props?: Partial<LumiAdminLoginProps>, toast?: boolean } = {}) {
  const login = vi.fn(options.login ?? (async () => ({ success: true })))
  const toast = { open: vi.fn((_params: ToastParams) => 'toast-key'), close: vi.fn() } satisfies ToastProvider
  const onSuccess = vi.fn()
  const i18nProvider = createAdminI18nProvider(createI18nProvider({
    locale: 'en-US',
    fallbackLocale: 'en-US',
    translations: { 'zh-CN': { 'Incorrect username or password.': '用户名或密码错误。' } },
  }))
  const context = createLumi({
    authProvider: { login, logout: async () => ({ success: true }), check: async () => ({ authenticated: false }) },
    i18nProvider,
    ...(options.toast === false ? {} : { toastProvider: toast }),
  })
  const element: ReactElement = (
    <LumiProvider context={context} registry={{}}>
      <AdminColorModeProvider initialPreference="system" storageBase={STORAGE}>
        <LumiAdminLogin title="Acme" locales={LOCALES} storageBase={STORAGE} onSuccess={onSuccess} {...options.props} />
      </AdminColorModeProvider>
    </LumiProvider>
  )
  return { login, toast, onSuccess, i18nProvider, element }
}

const $ = <T extends HTMLElement = HTMLElement>(testId: string): T | null => container.querySelector<T>(`[data-testid="${testId}"]`)

function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
}

async function submit(): Promise<void> {
  await act(async () => {
    $('admin-login-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

async function signIn(username: string, password: string): Promise<void> {
  await act(async () => {
    type($<HTMLInputElement>('admin-login-username')!, username)
    type($<HTMLInputElement>('admin-login-password')!, password)
  })
  await submit()
}

describe('admin sign-in page', () => {
  it('labels its fields for autofill and assistive technology', async () => {
    const { element } = setup()
    await act(async () => root.render(element))
    const username = $<HTMLInputElement>('admin-login-username')!
    const password = $<HTMLInputElement>('admin-login-password')!
    expect(container.querySelector(`label[for="${username.id}"]`)?.textContent).toBe('Username')
    expect(container.querySelector(`label[for="${password.id}"]`)?.textContent).toBe('Password')
    expect(username.getAttribute('autocomplete')).toBe('username')
    expect(password.getAttribute('autocomplete')).toBe('current-password')
    expect(password.type).toBe('password')
    // The mark is the title's initial; a logo replaces it.
    expect(container.querySelector('.lumi-auth__brand .lumi-brand-mark')?.textContent).toBe('A')
    // A production sign-in shows no demo account.
    expect($('admin-login-demo')).toBeNull()
  })

  it('reveals the password on request', async () => {
    const { element } = setup()
    await act(async () => root.render(element))
    const reveal = $('admin-login-reveal')!
    expect(reveal.getAttribute('aria-pressed')).toBe('false')
    await click(reveal)
    expect($<HTMLInputElement>('admin-login-password')!.type).toBe('text')
    expect(reveal.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks empty fields instead of calling the provider', async () => {
    const { element, login } = setup()
    await act(async () => root.render(element))
    await submit()
    const username = $<HTMLInputElement>('admin-login-username')!
    expect(login).not.toHaveBeenCalled()
    expect(username.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(username)
    expect(document.getElementById(username.getAttribute('aria-describedby')!)?.textContent).toBe('Enter your username.')
    await act(async () => type(username, 'admin'))
    expect(username.getAttribute('aria-invalid')).not.toBe('true')
  })

  it('reports rejected credentials inline, in the reader\'s language', async () => {
    const { element, login, toast, onSuccess, i18nProvider } = setup({
      login: async () => ({ success: false, error: new Error('Incorrect username or password.') }),
    })
    await act(async () => root.render(element))
    await signIn('admin', 'wrong')
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'wrong', remember: false })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(toast.open).not.toHaveBeenCalled()
    const region = container.querySelector('.lumi-auth__alert')!
    expect(region.getAttribute('aria-live')).toBe('assertive')
    expect($('admin-login-error')?.textContent).toContain('Sign-in failed')
    expect($('admin-login-error')?.textContent).toContain('Incorrect username or password.')
    for (const field of ['admin-login-username', 'admin-login-password']) {
      expect($(field)!.getAttribute('aria-invalid')).toBe('true')
      expect($(field)!.getAttribute('aria-describedby')).toContain(region.id)
    }
    // The message is kept raw and translated when shown.
    await act(async () => i18nProvider.changeLocale('zh-CN'))
    expect($('admin-login-error')?.textContent).toContain('登录失败')
    expect($('admin-login-error')?.textContent).toContain('用户名或密码错误。')
  })

  it('reports an unreachable server as a toast, inline only without one', async () => {
    const failing = { login: async () => Promise.reject(new Error('Failed to fetch')) }
    const withToast = setup(failing)
    await act(async () => root.render(withToast.element))
    await signIn('admin', 'admin')
    expect(withToast.toast.open).toHaveBeenCalledWith({ tone: 'danger', message: 'Failed to fetch' })
    expect($('admin-login-error')).toBeNull()

    const withoutToast = setup({ ...failing, toast: false })
    await act(async () => root.render(<div key="without-toast">{withoutToast.element}</div>))
    await signIn('admin', 'admin')
    expect($('admin-login-error')?.textContent).toContain('Failed to fetch')
  })

  it('signs in with the remember choice and hands the result on', async () => {
    const { element, login, onSuccess } = setup()
    await act(async () => root.render(element))
    await click(container.querySelector<HTMLElement>('.lumi-auth__remember [role="checkbox"]')!)
    await signIn('admin', 'admin')
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'admin', remember: true })
    expect(onSuccess).toHaveBeenCalledWith({ success: true })
  })

  it('leaves out remember me when the app does not offer it', async () => {
    const { element, login } = setup({ props: { remember: false } })
    await act(async () => root.render(element))
    expect(container.querySelector('.lumi-auth__remember')).toBeNull()
    await signIn('admin', 'admin')
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'admin' })
  })

  it('fills a demo deployment\'s account from its hint', async () => {
    const { element } = setup({ props: { demo: { username: 'demo', password: 'pass' } } })
    await act(async () => root.render(element))
    expect($('admin-login-demo')?.textContent).toContain('demo')
    await click(container.querySelector<HTMLElement>('[aria-label="Fill in the demo account"]')!)
    expect($<HTMLInputElement>('admin-login-username')!.value).toBe('demo')
    expect($<HTMLInputElement>('admin-login-password')!.value).toBe('pass')
  })

  it('answers "forgot password" with a toast, a link, or nothing', async () => {
    const toastCase = setup()
    await act(async () => root.render(toastCase.element))
    expect($('admin-login-forgot')!.tagName).toBe('BUTTON')
    await click($('admin-login-forgot')!)
    expect(toastCase.toast.open).toHaveBeenCalledWith(expect.objectContaining({ tone: 'info', message: 'Ask your administrator to reset your password.' }))

    await act(async () => root.render(<div key="href">{setup({ props: { forgotPassword: { href: '/reset' } } }).element}</div>))
    expect($<HTMLAnchorElement>('admin-login-forgot')!.getAttribute('href')).toBe('/reset')

    await act(async () => root.render(<div key="hidden">{setup({ props: { forgotPassword: false } }).element}</div>))
    expect($('admin-login-forgot')).toBeNull()
  })

  it('switches theme and language before sign-in and saves both for the Shell', async () => {
    localStorage.setItem(`${STORAGE}:preferences`, JSON.stringify({ collapsed: true, colorMode: 'system' }))
    const { element, i18nProvider } = setup()
    await act(async () => root.render(element))
    expect(container.querySelector('[role="radiogroup"][aria-label="Theme"]')).toBeTruthy()
    expect($('admin-login-theme-system')!.getAttribute('aria-checked')).toBe('true')

    await click($('admin-login-theme-dark')!)
    expect($('admin-login-theme-dark')!.getAttribute('aria-checked')).toBe('true')
    expect(JSON.parse(localStorage.getItem(`${STORAGE}:preferences`)!)).toEqual({ collapsed: true, colorMode: 'dark' })

    // Arrow keys move the choice within the group, as a radio group does.
    await act(async () => $('admin-login-theme-dark')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect($('admin-login-theme-system')!.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe($('admin-login-theme-system'))

    expect($('admin-login-locale')!.getAttribute('aria-label')).toBe('Language: English')
    await click($('admin-login-locale-zh-CN')!)
    expect(i18nProvider.getLocale()).toBe('zh-CN')
    expect(localStorage.getItem(`${STORAGE}:locale`)).toBe('zh-CN')
    expect(container.querySelector('h1')?.textContent).toBe('欢迎回来')
  })

  it('hides the language switch for a single-language app', async () => {
    const { element } = setup({ props: { locales: [LOCALES[0]!] } })
    await act(async () => root.render(element))
    expect($('admin-login-locale')).toBeNull()
  })
})
