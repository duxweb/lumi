import type { ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { LumiInput } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { ShellChrome } from './ShellIcon.js'

export interface PasswordInputProps {
  id: string
  testId?: string
  /** The test id of the show / hide button. */
  revealTestId?: string
  name?: string
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
  value: string
  invalid?: boolean
  describedBy?: string | undefined
  onChange: (value: string) => void
}

/** A password field with a button that shows what was typed, shared by every account page. */
export function PasswordInput(props: PasswordInputProps): ReactElement {
  const translate = useTranslate()
  const [revealed, setRevealed] = useState(false)
  const show = translate('lumi.login.showPassword', undefined, 'Show password')
  return (
    <div className="lumi-auth__password">
      <LumiInput
        id={props.id}
        data-testid={props.testId}
        type={revealed ? 'text' : 'password'}
        name={props.name ?? 'password'}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        size="lg"
        value={props.value}
        invalid={props.invalid}
        aria-describedby={props.describedBy}
        onChange={value => props.onChange(String(value ?? ''))}
      />
      <button
        type="button"
        className="lumi-auth__reveal"
        data-testid={props.revealTestId ?? 'admin-login-reveal'}
        aria-label={show}
        title={revealed ? translate('lumi.login.hidePassword', undefined, 'Hide password') : show}
        aria-controls={props.id}
        aria-pressed={revealed}
        onClick={() => setRevealed(value => !value)}
      >
        <ShellChrome name={revealed ? 'eye-off' : 'eye'} className="size-4" />
      </button>
    </div>
  )
}
