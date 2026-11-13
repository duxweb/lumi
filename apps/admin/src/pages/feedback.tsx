import type { LumiPageState } from '@duxweb/lumi-admin'
import type { ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { LumiPage } from '@duxweb/lumi-admin'
import { useNavigate } from 'react-router'

/**
 * Result and exception pages are the page state with nothing behind it. They
 * get routes of their own so the states every other page can enter are visible
 * and testable without having to break a request first.
 */
function StatePage({ state, ariaLabel }: { state: LumiPageState, ariaLabel: string }): ReactElement {
  return <LumiPage state={state} width="content" ariaLabel={ariaLabel} />
}

export function AdminResultSuccessRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  return (
    <StatePage
      ariaLabel={t('Submission complete')}
      state={{
        kind: 'success',
        title: t('Order ORD-00042 submitted'),
        message: t('Fulfilment picks it up in the next sync. You can close this tab'),
        actionLabel: t('Back to orders'),
        onAction: () => navigate('/orders'),
      }}
    />
  )
}

export function AdminResultFailRoute(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  return (
    <StatePage
      ariaLabel={t('Submission failed')}
      state={{
        kind: 'error',
        title: t('Order could not be submitted'),
        reason: t('Two line items are below the reorder point and the warehouse rejected the batch'),
        nextStep: t('Adjust the quantities on those lines and submit again'),
        actionLabel: t('Back to products'),
        onAction: () => navigate('/products'),
      }}
    />
  )
}

export function AdminException403Route(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  return (
    <StatePage
      ariaLabel={t('Access denied')}
      state={{
        kind: 'permission',
        title: t('You do not have access to this page'),
        reason: t('Billing is limited to workspace owners'),
        nextStep: t('Ask an owner to grant the billing role, or switch to an account that has it'),
        actionLabel: t('Back to dashboard'),
        onAction: () => navigate('/'),
      }}
    />
  )
}

export function AdminException404Route(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  return (
    <StatePage
      ariaLabel={t('Page not found')}
      state={{
        kind: 'empty',
        title: t('That page does not exist'),
        reason: t('The address may be mistyped, or the record it pointed at was deleted'),
        nextStep: t('Check the link, or start again from the dashboard'),
        actionLabel: t('Back to dashboard'),
        onAction: () => navigate('/'),
      }}
    />
  )
}

export function AdminException500Route(): ReactElement {
  const t = useTranslate()
  return (
    <StatePage
      ariaLabel={t('Server error')}
      state={{
        kind: 'error',
        title: t('The server failed to complete the request'),
        reason: t('An unhandled error was returned by the admin API'),
        nextStep: t('Retry in a moment. If it keeps failing, send the request id to support'),
        actionLabel: t('Retry'),
        onAction: () => globalThis.location.reload(),
      }}
    />
  )
}
