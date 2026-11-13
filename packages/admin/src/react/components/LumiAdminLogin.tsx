import type { AuthActionResponse } from '@duxweb/lumi'
import type { FormEvent, ReactElement } from 'react'
import type { LumiAuthBrandProps } from './LumiAuthLayout.js'
import { useLogin, useToast, useTranslate } from '@duxweb/lumi'
import { LumiAlert, LumiButton, LumiCheckbox, LumiInput } from '@duxweb/lumi-ui'
import { useId, useState } from 'react'
import { PasswordInput } from './LumiAuthFields.js'
import { AuthHeading, AuthLink, LumiAuthLayout } from './LumiAuthLayout.js'
import { ShellIcon } from './ShellIcon.js'

export interface LumiAdminLoginProps extends LumiAuthBrandProps {
  /** Line under the "Welcome back" heading. */
  subtitle?: string
  /** A demo deployment's account, offered in a hint that fills the form. */
  demo?: { username: string, password: string }
  /**
   * `false` hides "Forgot password?"; `href` opens that page. Otherwise an auth
   * provider with `forgotPassword` opens the built-in reset page, and one
   * without shows `message` (or a default asking for the administrator) as a toast.
   */
  forgotPassword?: false | { href?: string, message?: string }
  /** Where "Create account" leads; without it the card says accounts are assigned when `assignedNote` is set. */
  register?: { href: string }
  /** The note under the card when there is no sign-up, e.g. that an administrator assigns accounts. */
  assignedNote?: string
  /** Offer "Remember me" (default true); the choice reaches the auth provider's `login` as `remember`. */
  remember?: boolean
  onSuccess?: (result: AuthActionResponse) => Promise<void> | void
}

type Field = 'username' | 'password'

/** A rejected sign-in; `message` is the provider's, translated when shown. */
interface Failure {
  message?: string
}

/** The sign-in page: brand panel, form, demo-account hint and links, from the `login` config. */
export function LumiAdminLogin(props: LumiAdminLoginProps): ReactElement {
  const { subtitle, demo, forgotPassword, register, assignedNote, remember: offerRememberProp, onSuccess, ...brand } = props
  const translate = useTranslate()
  const login = useLogin()
  const toast = useToast()
  const ids = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [missing, setMissing] = useState<Partial<Record<Field, boolean>>>({})
  const [failure, setFailure] = useState<Failure>()
  // A rejected sign-in marks both fields: the server does not say which one was wrong.
  const [rejected, setRejected] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const t = (key: string, fallback: string, params?: Record<string, unknown>): string => translate(key, params, fallback)
  const usernameId = `${ids}-username`
  const passwordId = `${ids}-password`
  const errorId = `${ids}-error`
  const headingId = `${ids}-heading`
  const offerRemember = offerRememberProp !== false
  const forgot = forgotPassword

  const fieldError = {
    username: missing.username ? t('lumi.login.usernameRequired', 'Enter your username.') : undefined,
    password: missing.password ? t('lumi.login.passwordRequired', 'Enter your password.') : undefined,
  }
  // The provider's message doubles as its own key, so an app can translate what its backend says.
  const failureText = failure
    ? failure.message ? translate(failure.message, undefined, failure.message) : t('lumi.login.invalid', 'Check your username and password and try again.')
    : undefined
  const describedBy = (field: Field): string | undefined =>
    [missing[field] ? `${ids}-${field}-error` : undefined, failure ? errorId : undefined].filter(Boolean).join(' ') || undefined
  const edit = (field: Field, set: (value: string) => void) => (value: string): void => {
    set(value)
    setRejected(false)
    if (missing[field])
      setMissing(current => ({ ...current, [field]: false }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submitting)
      return
    const empty = { username: !username.trim(), password: !password }
    setFailure(undefined)
    setRejected(false)
    setMissing(empty)
    if (empty.username || empty.password) {
      document.getElementById(empty.username ? usernameId : passwordId)?.focus()
      return
    }
    setSubmitting(true)
    try {
      const result = await login.mutateAsync({ username, password, ...(offerRemember ? { remember } : {}) })
      if (result.success === false) {
        setFailure({ message: result.error?.message || undefined })
        setRejected(true)
        return
      }
      await onSuccess?.(result)
    }
    catch (reason) {
      // A thrown sign-in is the connection, not the credentials: it is reported
      // as a passing toast, and inline only when the app draws no toasts.
      const message = reason instanceof Error && reason.message ? reason.message : undefined
      if (toast.open({ tone: 'danger', message: message ?? t('lumi.login.failed', 'Sign-in failed') }) === undefined)
        setFailure({ message })
    }
    finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (): void => {
    if (!demo)
      return
    setUsername(demo.username)
    setPassword(demo.password)
    setMissing({})
    setRejected(false)
    setFailure(undefined)
  }

  const forgotLabel = t('lumi.login.forgot', 'Forgot password?')

  const forgotLink = forgot === false
    ? null
    : forgot?.href
      ? <AuthLink to={forgot.href} navigate={brand.navigate} testId="admin-login-forgot">{forgotLabel}</AuthLink>
      : (
          <button
            type="button"
            className="lumi-auth__link"
            data-testid="admin-login-forgot"
            onClick={() => toast.open({ key: 'lumi-login-forgot', tone: 'info', message: forgot?.message ?? t('lumi.login.forgotHint', 'Ask your administrator to reset your password.') })}
          >
            {forgotLabel}
          </button>
        )

  return (
    <LumiAuthLayout {...brand} testId="admin-login">
      <form data-testid="admin-login-form" className="lumi-auth__form" aria-labelledby={headingId} noValidate onSubmit={event => void submit(event)}>
        <AuthHeading id={headingId} title={t('lumi.login.welcome', 'Welcome back')} description={subtitle ?? t('lumi.login.subtitle', 'Sign in to manage your workspace.')} />

        <div className="lumi-auth__fields">
          <div className="lumi-auth__field">
            <label htmlFor={usernameId}>{t('lumi.login.username', 'Username')}</label>
            <LumiInput
              id={usernameId}
              data-testid="admin-login-username"
              name="username"
              autoComplete="username"
              placeholder={t('lumi.login.usernamePlaceholder', 'Enter your username')}
              size="lg"
              value={username}
              invalid={Boolean(missing.username) || rejected}
              aria-describedby={describedBy('username')}
              onChange={edit('username', setUsername)}
            />
            {fieldError.username ? <p id={`${ids}-username-error`} className="lumi-auth__field-error">{fieldError.username}</p> : null}
          </div>
          <div className="lumi-auth__field">
            <div className="lumi-auth__label-row">
              <label htmlFor={passwordId}>{t('lumi.login.password', 'Password')}</label>
              {forgotLink}
            </div>
            <PasswordInput
              id={passwordId}
              testId="admin-login-password"
              autoComplete="current-password"
              placeholder={t('lumi.login.passwordPlaceholder', 'Enter your password')}
              value={password}
              invalid={Boolean(missing.password) || rejected}
              describedBy={describedBy('password')}
              onChange={edit('password', setPassword)}
            />
            {fieldError.password ? <p id={`${ids}-password-error`} className="lumi-auth__field-error">{fieldError.password}</p> : null}
          </div>
        </div>

        {offerRemember ? <LumiCheckbox className="lumi-auth__remember" label={t('lumi.login.remember', 'Remember me')} name="remember" value={remember} onChange={setRemember} /> : null}

        {/* The region is always present, so the message is announced when it lands. */}
        <div id={errorId} className="lumi-auth__alert" aria-live="assertive" aria-atomic="true">
          {failureText ? <LumiAlert tone="danger" role="none" title={t('lumi.login.failed', 'Sign-in failed')} message={failureText} data-testid="admin-login-error" /> : null}
        </div>

        <LumiButton
          className="lumi-auth__submit"
          loading={submitting}
          data-testid="admin-login-submit"
          block
          size="lg"
          type="submit"
          icon="arrow-right-02"
          iconPosition="right"
          label={submitting ? t('lumi.login.submitting', 'Signing in...') : t('lumi.login.submit', 'Sign in')}
        />

        {demo
          ? (
              <div className="lumi-auth__demo" data-testid="admin-login-demo">
                <span className="lumi-auth__demo-icon" aria-hidden><ShellIcon name="key-round" className="size-3.5" /></span>
                <span className="lumi-auth__demo-text">
                  <span>{t('lumi.login.demo', 'Demo account')}</span>
                  <code>{demo.username}</code>
                  <span aria-hidden>/</span>
                  <code>{demo.password}</code>
                </span>
                <button type="button" className="lumi-auth__link" data-tone="brand" aria-label={t('lumi.login.fillDemoLabel', 'Fill in the demo account')} onClick={fillDemo}>
                  {t('lumi.login.fillDemo', 'Fill in')}
                </button>
              </div>
            )
          : null}

        {register
          ? (
              <p className="lumi-auth__switch">
                {t('lumi.login.noAccount', 'New here?')}
                {' '}
                <AuthLink to={register.href} navigate={brand.navigate} testId="admin-login-register">{t('lumi.login.createAccount', 'Create an account')}</AuthLink>
              </p>
            )
          : assignedNote ? <p className="lumi-auth__note">{assignedNote}</p> : null}
      </form>
    </LumiAuthLayout>
  )
}
