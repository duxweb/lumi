import type { ReactElement } from 'react'
import { useForm, useList, useOne, useTranslate } from '@duxweb/lumi'
import { LumiFormRow, LumiFormSection, useAdminDrawer } from '@duxweb/lumi-admin'
import { LumiForm as Form, LumiFormField as FormField, LumiText as Text } from '@duxweb/lumi-ui'
import { useDrawerSave } from '../drawer-form.js'

interface User {
  id: number
  name: string
  email: string
  role: string
  active?: boolean
}

interface UserDraft {
  name: string
  email: string
  role: string
  active: boolean
}

interface Role {
  id: number
  name: string
  code: string
  permissions?: string[]
}

interface RoleDraft {
  name: string
  code: string
  permissions: string[]
}

/** Resources the mock access provider checks; codes are `resource:action`. */
const RESOURCES = ['products', 'categories', 'orders', 'customers', 'users', 'roles', 'articles', 'projects', 'activities', 'notes']
const ACTIONS = ['list', 'show', 'create', 'edit', 'delete', 'export'].map(value => ({ value, label: value.slice(0, 1).toUpperCase() + value.slice(1) }))

const BLANK_USER: UserDraft = { name: '', email: '', role: 'support', active: true }
const BLANK_ROLE: RoleDraft = { name: '', code: '', permissions: ['articles:list', 'projects:list'] }

const title = (resource: string): string => resource.slice(0, 1).toUpperCase() + resource.slice(1)

/** `?drawer=edit-user` creates a user; `&record=<id>` edits one. */
export function UserEditDrawer(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const creating = !drawer.recordId
  const query = useOne<User>({ resource: 'users', id: drawer.recordId, enabled: !creating })
  const roles = useList<Role>({ resource: 'roles', pagination: { page: 1, pageSize: 50 } })
  const user = query.data?.data
  const form = useForm<UserDraft>({
    resource: 'users',
    id: drawer.recordId,
    initialValues: creating ? BLANK_USER : user ? { name: user.name, email: user.email, role: user.role, active: user.active !== false } : undefined,
    rules: {
      type: 'object',
      required: ['name', 'email', 'role'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', minLength: 3 },
      },
    },
  })
  const save = useDrawerSave(form, {
    owner: 'user-edit',
    title: creating ? t('New user') : t('Edit user'),
    description: user ? `${user.email} · ${user.name}` : undefined,
    ready: creating || Boolean(user),
  })
  const error = (name: keyof UserDraft): string | undefined => form.errors.find(issue => issue.path === name)?.message
  if (!creating && query.isPending)
    return <Text variant="muted" role="status" text={t('Loading user…')} />
  return (
    <Form value={{ ...form.values }} disabled={form.isSubmitting} data-testid="user-edit-drawer" onSubmit={save}>
      <LumiFormSection title={t('Identity')} description={t('The name and email this person signs in with')}>
        <LumiFormRow span="full">
          <FormField name="name" label={t('Full name')} required value={form.values.name} error={error('name')} onChange={value => form.setValue('name', value)} />
        </LumiFormRow>
        <LumiFormRow span="full">
          <FormField name="email" label={t('Email')} type="email" required value={form.values.email} error={error('email')} onChange={value => form.setValue('email', value)} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Access')} description={t('The role decides what this user may list, open and change')}>
        <LumiFormRow>
          <FormField
            name="role"
            label={t('Role')}
            fieldType="enum"
            widget="Select"
            required
            value={form.values.role}
            options={(roles.data?.data ?? []).map(role => ({ label: role.name, value: role.code }))}
            onChange={value => form.setValue('role', value)}
          />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="active" label={t('Can sign in')} help={t('Suspended users keep their history but cannot sign in')} fieldType="boolean" widget="Switch" value={form.values.active} onChange={value => form.setValue('active', value)} />
        </LumiFormRow>
      </LumiFormSection>
    </Form>
  )
}

/** `?drawer=edit-role` creates a role; `&record=<id>` edits one. */
export function RoleEditDrawer(): ReactElement {
  const t = useTranslate()
  const drawer = useAdminDrawer()
  const creating = !drawer.recordId
  const query = useOne<Role>({ resource: 'roles', id: drawer.recordId, enabled: !creating })
  const role = query.data?.data
  const form = useForm<RoleDraft>({
    resource: 'roles',
    id: drawer.recordId,
    initialValues: creating ? BLANK_ROLE : role ? { name: role.name, code: role.code, permissions: role.permissions ?? [] } : undefined,
    rules: {
      type: 'object',
      required: ['name', 'code'],
      properties: {
        name: { type: 'string', minLength: 2 },
        code: { type: 'string', minLength: 2 },
      },
    },
  })
  const save = useDrawerSave(form, {
    owner: 'role-edit',
    title: creating ? t('New role') : t('Edit role'),
    description: role ? `${role.code} · ${t('{count} permissions', { count: (role.permissions ?? []).length })}` : undefined,
    ready: creating || Boolean(role),
  })
  const error = (name: keyof RoleDraft): string | undefined => form.errors.find(issue => issue.path === name)?.message
  const granted = form.values.permissions ?? []
  const actionsFor = (resource: string): string[] => granted.filter(code => code.startsWith(`${resource}:`)).map(code => code.slice(resource.length + 1))
  const setActions = (resource: string, actions: readonly string[]): void => {
    form.setValue('permissions', [...granted.filter(code => !code.startsWith(`${resource}:`)), ...actions.map(action => `${resource}:${action}`)])
  }
  if (!creating && query.isPending)
    return <Text variant="muted" role="status" text={t('Loading role…')} />
  return (
    <Form value={{ ...form.values }} disabled={form.isSubmitting} data-testid="role-edit-drawer" onSubmit={save}>
      <LumiFormSection title={t('Role')} description={t('The code is what users and the access provider refer to')}>
        <LumiFormRow>
          <FormField name="name" label={t('Role name')} required value={form.values.name} error={error('name')} onChange={value => form.setValue('name', value)} />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="code" label={t('Code')} required value={form.values.code} error={error('code')} help={t('Lowercase, e.g. `editor`')} onChange={value => form.setValue('code', value)} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Permissions')} description={t('{count} granted. Each one is a resource:action code the access provider checks before a route, a button or a request', { count: granted.length })}>
        {RESOURCES.map(resource => (
          <LumiFormRow key={resource} span="full">
            <FormField
              name={`permissions.${resource}`}
              label={title(resource)}
              fieldType="enumMulti"
              widget="CheckboxGroup"
              direction="row"
              value={actionsFor(resource)}
              options={ACTIONS}
              onChange={value => setActions(resource, Array.isArray(value) ? value.map(String) : [])}
            />
          </LumiFormRow>
        ))}
      </LumiFormSection>
    </Form>
  )
}
