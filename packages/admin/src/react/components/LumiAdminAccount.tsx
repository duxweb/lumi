import type { AuthActionResponse } from '@duxweb/lumi'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import type { LumiAuthBrandProps } from './LumiAuthLayout.js'
import { useForgotPassword, useRegister, useTranslate, useUpdatePassword } from '@duxweb/lumi'
import { LumiAlert, LumiButton, LumiInput } from '@duxweb/lumi-ui'
import { useId, useState } from 'react'
import { PasswordInput } from './LumiAuthFields.js'
import { AuthHeading, AuthLink, LumiAuthLayout, useAuthText } from './LumiAuthLayout.js'
import { ShellIcon } from './ShellIcon.js'

/** The shortest password the account pages accept before asking the server. */
const MIN_PASSWORD = 8
const SPACE_RE = /\s/

/** Something before the `@`, a dot after it and no spaces: the server decides the rest. */
function isEmail(value: string): boolean {
  const at = value.indexOf('@')
  return at > 0 && !value.includes('@', at + 1) && value.lastIndexOf('.') > at + 1 && !value.endsWith('.') && !SPACE_RE.test(value)
}

interface AccountPageProps extends LumiAuthBrandProps {
  /** The sign-in page, linked from every account page; defaults to `/login`. */
  loginHref?: string
}

type Errors<Field extends string> = Partial<Record<Field, string>>

/**
 * The form state every account page shares: its values, the fields left
 * wrong, the server's refusal, and a submission that cannot run twice.
 */
interface AccountForm<Field extends string> {
  ids: string
  values: Record<Field, string>
  errors: Errors<Field>
  failure: string | undefined
  submitting: boolean
  id: (field: Field) => string
  set: (field: Field) => (value: string) => void
  describedBy: (field: Field) => string | undefined
  run: (event: FormEvent<HTMLFormElement>, check: Errors<Field>, action: () => Promise<AuthActionResponse>, fallback: string, done: (result: AuthActionResponse) => Promise<void> | void) => Promise<void>
}

function useAccountForm<Field extends string>(initial: Record<Field, string>): AccountForm<Field> {
  const translate = useTranslate()
  const ids = useId()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [failure, setFailure] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const id = (field: Field): string => `${ids}-${field}`
  return {
    ids,
    values,
    errors,
    failure,
    submitting,
    id,
    set: (field: Field) => (value: string): void => {
      setValues(current => ({ ...current, [field]: value }))
      if (errors[field])
        setErrors(current => ({ ...current, [field]: undefined }))
    },
    describedBy: (field: Field): string | undefined =>
      [errors[field] ? `${id(field)}-error` : undefined, failure ? `${ids}-failure` : undefined].filter(Boolean).join(' ') || undefined,
    /** Checks the fields, then runs `action`; a refusal shows the server's message, translated when the app knows it. */
    run: async (event: FormEvent<HTMLFormElement>, check: Errors<Field>, action: () => Promise<AuthActionResponse>, fallback: string, done: (result: AuthActionResponse) => Promise<void> | void): Promise<void> => {
      event.preventDefault()
      if (submitting)
        return
      const found = Object.fromEntries(Object.entries(check).filter(([, message]) => message)) as Errors<Field>
      setErrors(found)
      setFailure(undefined)
      const first = Object.keys(found)[0] as Field | undefined
      if (first) {
        document.getElementById(id(first))?.focus()
        return
      }
      setSubmitting(true)
      try {
        const result = await action()
        if (result.success === false) {
          const message = result.error?.message
          setFailure(message ? translate(message, undefined, message) : fallback)
          return
        }
        await done(result)
      }
      catch (reason) {
        const message = reason instanceof Error && reason.message ? reason.message : undefined
        setFailure(message ? translate(message, undefined, message) : fallback)
      }
      finally {
        setSubmitting(false)
      }
    },
  }
}

function FieldError({ id, message }: { id: string, message: string | undefined }): ReactNode {
  return message ? <p id={`${id}-error`} className="lumi-auth__field-error">{message}</p> : null
}

/** The live region for a refusal: always mounted, so the message is announced when it lands. */
function Failure({ id, title, message, testId }: { id: string, title: string, message: string | undefined, testId: string }): ReactElement {
  return (
    <div id={id} className="lumi-auth__alert" aria-live="assertive" aria-atomic="true">
      {message ? <LumiAlert tone="danger" role="none" title={title} message={message} data-testid={testId} /> : null}
    </div>
  )
}

/** A finished step: what happened, and where to go next. */
function Outcome({ icon, title, description, children, headingId }: { icon: string, title: string, description: string, children: ReactNode, headingId: string }): ReactElement {
  return (
    <section className="lumi-auth__outcome" aria-labelledby={headingId} role="status">
      <span className="lumi-auth__outcome-icon" aria-hidden><ShellIcon name={icon} className="size-5" /></span>
      <AuthHeading id={headingId} title={title} description={description} />
      {children}
    </section>
  )
}

function BackToSignIn({ href, navigate, label }: { href: string, navigate?: (to: string) => void, label: string }): ReactElement {
  return (
    <p className="lumi-auth__switch">
      <AuthLink to={href} navigate={navigate} testId="admin-account-login">{label}</AuthLink>
    </p>
  )
}

export interface LumiAdminRegisterProps extends AccountPageProps {
  /** Line under the heading. */
  subtitle?: string
  /** Called once the account exists; a provider that signs it in says so in the result. */
  onSuccess?: (result: AuthActionResponse) => Promise<void> | void
}

/** Sign-up through `authProvider.register`: name, email and password, checked here before the server sees them. */
export function LumiAdminRegister(props: LumiAdminRegisterProps): ReactElement {
  const { subtitle, onSuccess, loginHref = '/login', ...brand } = props
  const t = useAuthText()
  const register = useRegister()
  const form = useAccountForm({ name: '', email: '', password: '' })
  const headingId = `${form.ids}-heading`
  const { values } = form

  const submit = (event: FormEvent<HTMLFormElement>): Promise<void> => form.run(
    event,
    {
      name: values.name.trim() ? undefined : t('lumi.register.nameRequired', 'Enter your name.'),
      email: isEmail(values.email.trim()) ? undefined : t('lumi.account.emailInvalid', 'Enter a valid email address.'),
      password: values.password.length >= MIN_PASSWORD ? undefined : t('lumi.account.passwordShort', 'Use at least {count} characters.', { count: MIN_PASSWORD }),
    },
    () => register.mutateAsync({ name: values.name.trim(), email: values.email.trim(), password: values.password }),
    t('lumi.register.failed', 'The account could not be created.'),
    result => onSuccess?.(result),
  )

  return (
    <LumiAuthLayout {...brand} testId="admin-register">
      <form data-testid="admin-register-form" className="lumi-auth__form" aria-labelledby={headingId} noValidate onSubmit={event => void submit(event)}>
        <AuthHeading id={headingId} title={t('lumi.register.title', 'Create your account')} description={subtitle ?? t('lumi.register.subtitle', 'It takes a minute; you can change the details later.')} />
        <div className="lumi-auth__fields">
          <div className="lumi-auth__field">
            <label htmlFor={form.id('name')}>{t('lumi.register.name', 'Name')}</label>
            <LumiInput id={form.id('name')} data-testid="admin-register-name" name="name" autoComplete="name" size="lg" placeholder={t('lumi.register.namePlaceholder', 'Your full name')} value={values.name} invalid={Boolean(form.errors.name)} aria-describedby={form.describedBy('name')} onChange={value => form.set('name')(String(value ?? ''))} />
            <FieldError id={form.id('name')} message={form.errors.name} />
          </div>
          <div className="lumi-auth__field">
            <label htmlFor={form.id('email')}>{t('lumi.account.email', 'Email')}</label>
            <LumiInput id={form.id('email')} data-testid="admin-register-email" type="email" name="email" autoComplete="email" size="lg" placeholder={t('lumi.account.emailPlaceholder', 'you@company.com')} value={values.email} invalid={Boolean(form.errors.email)} aria-describedby={form.describedBy('email')} onChange={value => form.set('email')(String(value ?? ''))} />
            <FieldError id={form.id('email')} message={form.errors.email} />
          </div>
          <div className="lumi-auth__field">
            <label htmlFor={form.id('password')}>{t('lumi.login.password', 'Password')}</label>
            <PasswordInput id={form.id('password')} testId="admin-register-password" revealTestId="admin-register-reveal" autoComplete="new-password" placeholder={t('lumi.account.newPasswordPlaceholder', 'At least {count} characters', { count: MIN_PASSWORD })} value={values.password} invalid={Boolean(form.errors.password)} describedBy={form.describedBy('password')} onChange={form.set('password')} />
            <FieldError id={form.id('password')} message={form.errors.password} />
          </div>
        </div>
        <Failure id={`${form.ids}-failure`} title={t('lumi.register.failedTitle', 'Sign-up failed')} message={form.failure} testId="admin-register-error" />
        <LumiButton className="lumi-auth__submit" loading={form.submitting} data-testid="admin-register-submit" block size="lg" type="submit" icon="arrow-right-02" iconPosition="right" label={form.submitting ? t('lumi.register.submitting', 'Creating account...') : t('lumi.register.submit', 'Create account')} />
        <p className="lumi-auth__switch">
          {t('lumi.register.haveAccount', 'Already have an account?')}
          {' '}
          <AuthLink to={loginHref} navigate={brand.navigate} testId="admin-account-login">{t('lumi.register.signIn', 'Sign in')}</AuthLink>
        </p>
      </form>
    </LumiAuthLayout>
  )
}

export interface LumiAdminForgotPasswordProps extends AccountPageProps {
  subtitle?: string
}

/** Asks `authProvider.forgotPassword` for a reset link; the answer never says whether the address has an account. */
export function LumiAdminForgotPassword(props: LumiAdminForgotPasswordProps): ReactElement {
  const { subtitle, loginHref = '/login', ...brand } = props
  const t = useAuthText()
  const request = useForgotPassword()
  const form = useAccountForm({ email: '' })
  const [sentTo, setSentTo] = useState<string>()
  const headingId = `${form.ids}-heading`
  const email = form.values.email.trim()
  const back = t('lumi.account.backToSignIn', 'Back to sign in')

  const send = (event: FormEvent<HTMLFormElement>): Promise<void> => form.run(
    event,
    { email: isEmail(email) ? undefined : t('lumi.account.emailInvalid', 'Enter a valid email address.') },
    () => request.mutateAsync({ email }),
    t('lumi.forgot.failed', 'The reset link could not be sent. Try again in a moment.'),
    () => setSentTo(email),
  )

  return (
    <LumiAuthLayout {...brand} testId="admin-forgot">
      {sentTo
        ? (
            <Outcome icon="mail" headingId={headingId} title={t('lumi.forgot.sentTitle', 'Check your inbox')} description={t('lumi.forgot.sentCopy', 'If an account uses {email}, a link to set a new password is on its way. It works once.', { email: sentTo })}>
              <form className="lumi-auth__form" noValidate onSubmit={event => void send(event)}>
                <Failure id={`${form.ids}-failure`} title={t('lumi.forgot.failedTitle', 'Not sent')} message={form.failure} testId="admin-forgot-error" />
                <LumiButton loading={form.submitting} appearance="outline" block size="lg" type="submit" data-testid="admin-forgot-resend" label={t('lumi.forgot.resend', 'Send again')} />
                <BackToSignIn href={loginHref} navigate={brand.navigate} label={back} />
              </form>
            </Outcome>
          )
        : (
            <form data-testid="admin-forgot-form" className="lumi-auth__form" aria-labelledby={headingId} noValidate onSubmit={event => void send(event)}>
              <AuthHeading id={headingId} title={t('lumi.forgot.title', 'Reset your password')} description={subtitle ?? t('lumi.forgot.subtitle', 'Enter the email of your account and we will send you a link to set a new password.')} />
              <div className="lumi-auth__fields">
                <div className="lumi-auth__field">
                  <label htmlFor={form.id('email')}>{t('lumi.account.email', 'Email')}</label>
                  <LumiInput id={form.id('email')} data-testid="admin-forgot-email" type="email" name="email" autoComplete="email" size="lg" placeholder={t('lumi.account.emailPlaceholder', 'you@company.com')} value={form.values.email} invalid={Boolean(form.errors.email)} aria-describedby={form.describedBy('email')} onChange={value => form.set('email')(String(value ?? ''))} />
                  <FieldError id={form.id('email')} message={form.errors.email} />
                </div>
              </div>
              <Failure id={`${form.ids}-failure`} title={t('lumi.forgot.failedTitle', 'Not sent')} message={form.failure} testId="admin-forgot-error" />
              <LumiButton className="lumi-auth__submit" loading={form.submitting} data-testid="admin-forgot-submit" block size="lg" type="submit" label={form.submitting ? t('lumi.forgot.submitting', 'Sending...') : t('lumi.forgot.submit', 'Send reset link')} />
              <BackToSignIn href={loginHref} navigate={brand.navigate} label={back} />
            </form>
          )}
    </LumiAuthLayout>
  )
}

export interface LumiAdminResetPasswordProps extends AccountPageProps {
  /** The token from the reset link, usually its `token` query parameter. */
  token: string | null
  /** Where a link without a token sends the reader for a new one; defaults to `/forgot-password`. */
  forgotHref?: string
}

/** Sets a new password through `authProvider.updatePassword` with the reset link's token. */
export function LumiAdminResetPassword(props: LumiAdminResetPasswordProps): ReactElement {
  const { token, loginHref = '/login', forgotHref = '/forgot-password', ...brand } = props
  const t = useAuthText()
  const update = useUpdatePassword()
  const form = useAccountForm({ password: '', confirm: '' })
  const [done, setDone] = useState(false)
  const headingId = `${form.ids}-heading`
  const { values } = form

  if (!token) {
    return (
      <LumiAuthLayout {...brand} testId="admin-reset">
        <Outcome icon="alert-circle" headingId={headingId} title={t('lumi.reset.missingTitle', 'This link is incomplete')} description={t('lumi.reset.missingCopy', 'Open the link from the email again, or ask for a new one.')}>
          <div className="lumi-auth__form">
            <AuthLink to={forgotHref} navigate={brand.navigate} className="lumi-auth__button" testId="admin-reset-request">{t('lumi.reset.requestNew', 'Send a new link')}</AuthLink>
            <BackToSignIn href={loginHref} navigate={brand.navigate} label={t('lumi.account.backToSignIn', 'Back to sign in')} />
          </div>
        </Outcome>
      </LumiAuthLayout>
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>): Promise<void> => form.run(
    event,
    {
      password: values.password.length >= MIN_PASSWORD ? undefined : t('lumi.account.passwordShort', 'Use at least {count} characters.', { count: MIN_PASSWORD }),
      confirm: values.confirm === values.password ? undefined : t('lumi.reset.mismatch', 'The two passwords differ.'),
    },
    () => update.mutateAsync({ token, password: values.password }),
    t('lumi.reset.failed', 'The password could not be changed.'),
    () => setDone(true),
  )

  return (
    <LumiAuthLayout {...brand} testId="admin-reset">
      {done
        ? (
            <Outcome icon="tick" headingId={headingId} title={t('lumi.reset.doneTitle', 'Password updated')} description={t('lumi.reset.doneCopy', 'Sign in with your new password.')}>
              <div className="lumi-auth__form">
                <AuthLink to={loginHref} navigate={brand.navigate} className="lumi-auth__button" testId="admin-account-login">{t('lumi.register.signIn', 'Sign in')}</AuthLink>
              </div>
            </Outcome>
          )
        : (
            <form data-testid="admin-reset-form" className="lumi-auth__form" aria-labelledby={headingId} noValidate onSubmit={event => void submit(event)}>
              <AuthHeading id={headingId} title={t('lumi.reset.title', 'Set a new password')} description={t('lumi.reset.subtitle', 'Choose a password you do not use anywhere else.')} />
              <div className="lumi-auth__fields">
                <div className="lumi-auth__field">
                  <label htmlFor={form.id('password')}>{t('lumi.reset.password', 'New password')}</label>
                  <PasswordInput id={form.id('password')} testId="admin-reset-password" revealTestId="admin-reset-reveal" autoComplete="new-password" placeholder={t('lumi.account.newPasswordPlaceholder', 'At least {count} characters', { count: MIN_PASSWORD })} value={values.password} invalid={Boolean(form.errors.password)} describedBy={form.describedBy('password')} onChange={form.set('password')} />
                  <FieldError id={form.id('password')} message={form.errors.password} />
                </div>
                <div className="lumi-auth__field">
                  <label htmlFor={form.id('confirm')}>{t('lumi.reset.confirm', 'Confirm password')}</label>
                  <PasswordInput id={form.id('confirm')} name="confirm" testId="admin-reset-confirm" revealTestId="admin-reset-confirm-reveal" autoComplete="new-password" value={values.confirm} invalid={Boolean(form.errors.confirm)} describedBy={form.describedBy('confirm')} onChange={form.set('confirm')} />
                  <FieldError id={form.id('confirm')} message={form.errors.confirm} />
                </div>
              </div>
              <Failure id={`${form.ids}-failure`} title={t('lumi.reset.failedTitle', 'Not changed')} message={form.failure} testId="admin-reset-error" />
              <LumiButton className="lumi-auth__submit" loading={form.submitting} data-testid="admin-reset-submit" block size="lg" type="submit" label={form.submitting ? t('lumi.reset.submitting', 'Saving...') : t('lumi.reset.submit', 'Save password')} />
              <BackToSignIn href={loginHref} navigate={brand.navigate} label={t('lumi.account.backToSignIn', 'Back to sign in')} />
            </form>
          )}
    </LumiAuthLayout>
  )
}
