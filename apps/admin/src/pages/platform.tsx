import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useCan, useIdentity, useList, usePermissions, useTranslate } from '@duxweb/lumi'
import { LumiEmptyState, LumiPage, LumiPageHeader, LumiToggleRow } from '@duxweb/lumi-admin'
import { LumiBadge as Badge, LumiButton as Button, LumiCard as Card, LumiDescriptionList as DescriptionList, LumiStack as Stack, LumiTable as Table } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { statsSpec, uploadSpec } from '../json-specs.js'
import { perLocale } from '../shared.js'
import { SpecPreview } from './json.js'

// Upload and access showcase. Composed only from public Lumi components.

export function AdminUploadRoute(): ReactElement {
  const t = useTranslate()
  const [revision, setRevision] = useState(0)
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Upload')}
        description={t('Upload fields in a native Spec use the Lumi upload service: progress, cancel, server errors and auth headers come from the service, and only the returned URLs reach state')}
        actions={<Button label={t('Reset example')} appearance="outline" onClick={() => setRevision(value => value + 1)} />}
      />
      <SpecPreview spec={uploadSpec} revision={revision} />
    </LumiPage>
  )
}

/* -------------------------------------------------------------------------- */

const CHECKS = perLocale(t => ([
  { resource: 'products', action: 'create', label: t('Create product') },
  { resource: 'products', action: 'delete', label: t('Delete product') },
  { resource: 'orders', action: 'edit', label: t('Edit order') },
  { resource: 'customers', action: 'create', label: t('Add customer') },
  { resource: 'users', action: 'list', label: t('List users') },
  { resource: 'roles', action: 'edit', label: t('Edit roles') },
] as const))

/** One useCan per action: the button is disabled, never hidden, so the gap stays visible. */
function AccessCheck({ resource, action, label }: { resource: string, action: string, label: string }): ReactElement {
  const t = useTranslate()
  const check = useCan({ resource, action })
  const allowed = check.data?.can === true
  return (
    <LumiToggleRow title={label} description={`${resource}:${action}`}>
      <Stack direction="horizontal" gap="md">
        <Button label={label} size="sm" appearance="outline" disabled={!allowed} />
        <Badge label={check.isLoading ? t('Checking') : allowed ? t('Allowed') : t('Denied')} tone={check.isLoading ? 'neutral' : allowed ? 'success' : 'danger'} dot />
      </Stack>
    </LumiToggleRow>
  )
}

interface Role { id: number, name: string, code: string, permissions: string[] }

const roleColumns = perLocale((t): TableColumn[] => ([
  { field: 'name', label: t('Role'), width: '10rem' },
  { field: 'code', label: t('Code'), kind: 'code', width: '7rem' },
  { field: 'count', label: t('Grants'), align: 'right', width: '6rem' },
  { field: 'resources', label: t('Resources'), truncate: true },
]))

function RoleMatrix(): ReactElement {
  const t = useTranslate()
  const roles = useList<Role>({ resource: 'roles', pagination: { page: 1, pageSize: 20 } })
  const rows = (roles.data?.data ?? []).map(role => ({
    id: role.id,
    name: role.name,
    code: role.code,
    count: role.permissions.length,
    resources: [...new Set(role.permissions.map(permission => permission.split(':')[0]))].join(', '),
  }))
  return <Table rowKey="id" columns={roleColumns(t)} rows={rows} loading={roles.isLoading} />
}

export function AdminPermissionsRoute(): ReactElement {
  const t = useTranslate()
  const identity = useIdentity<{ name: string, role: string }>()
  const permissions = usePermissions()
  const canListRoles = useCan({ resource: 'roles', action: 'list' })
  const granted = Array.isArray(permissions.data) ? permissions.data as string[] : []
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Route & action access')}
        description={t('The backend returns permission strings; the AccessProvider answers can(resource, action) for routes, menus and buttons. Sign in as manager/admin or support/admin to compare')}
      />
      <Card title={t('Signed-in account')}>
        <DescriptionList items={[
          { label: t('User'), value: identity.data?.name ?? '—' },
          { label: t('Role'), value: identity.data?.role ?? '—' },
          { label: t('Permissions'), value: granted.length },
        ]}
        />
      </Card>
      <Card title={t('Action checks')} description={t('Each row runs useCan. Route guards use the same provider through the manifest\'s route access')}>
        {CHECKS(t).map(check => <AccessCheck key={`${check.resource}:${check.action}`} {...check} />)}
      </Card>
      <Card title={t('Role matrix')} description={t('Listing roles needs roles:list, so this section is itself access-controlled')}>
        {canListRoles.data?.can
          ? <RoleMatrix />
          : (
              <LumiEmptyState
                kind="permission"
                compact
                title={t('Roles are not visible to this account')}
                reason={t('The signed-in role lacks roles:list')}
                nextStep={t('Sign in as admin/admin to see every role')}
              />
            )}
      </Card>
    </LumiPage>
  )
}

/* -------------------------------------------------------------------------- */

export function AdminStatsRoute(): ReactElement {
  const t = useTranslate()
  const [revision, setRevision] = useState(0)
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Stats & metrics')}
        description={t('Dashboard widgets in a native Spec: a backend can serve a whole dashboard. Values arrive as display strings, so no formatting code ships in JSON')}
        actions={<Button label={t('Reset example')} appearance="outline" onClick={() => setRevision(value => value + 1)} />}
      />
      <SpecPreview spec={statsSpec} revision={revision} />
    </LumiPage>
  )
}
