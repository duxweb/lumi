import type { ComponentRegistry } from '@json-render/react'
import type { ReactNode } from 'react'
import type { MountAdminExtensions } from './mountAdmin.js'
import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'
import { adminCatalogDefinitions } from '../catalog/index.js'
import { mergeAssistantAdditions } from './assistant-additions.js'
import { adminRegistry } from './registry.js'

/** What json-render hands a registered component. */
export interface AdminExtensionRenderProps {
  props: Record<string, any>
  children?: ReactNode
  emit: (event: string) => void
  [key: string]: unknown
}

/**
 * One component an extension adds to the catalog. `props` is a zod object so
 * Specs that use the component are validated like built-in ones.
 */
export interface AdminExtensionComponent {
  props?: z.ZodType
  slots?: string[]
  events?: string[]
  description?: string
  render: (input: AdminExtensionRenderProps) => ReactNode
}

/**
 * What an extension module contributes. A module written as plain JavaScript
 * — no bundler — default-exports `(runtime, { config, http }) => AdminExtension`,
 * so it reaches React, the Lumi hooks and the UI components through `runtime`
 * and shares the base's single React instance; `http` is the app's signed
 * request client for the data providers it adds.
 */
export type AdminExtension = Omit<MountAdminExtensions, 'catalog' | 'registry'> & {
  components?: Record<string, AdminExtensionComponent>
  /**
   * Definitions of the actions in `handlers`, so pages that use them are
   * validated like built-in ones. A handler without one is still accepted in
   * JSON, with its params unchecked.
   */
  actions?: Record<string, AdminExtensionAction>
}

/** One action an extension adds to the catalog; `params` is a zod object. */
export interface AdminExtensionAction {
  params?: z.ZodType
  description?: string
}

/** Identity helper that gives an extension module its types. */
export function defineAdminExtension<T extends AdminExtension>(extension: T): T {
  return extension
}

/**
 * Merges extensions in order: components join the Admin catalog and registry,
 * maps (handlers, data, auth and access providers, drawers, badges, upload and agent options)
 * merge key by key, lists (routes, assistant commands and @ tabs) concatenate — a command or tab with
 * the same value replacing the earlier one — every `onEvent` and
 * `onWorkspaceChange` listener is kept, and any other option is taken from
 * the last extension that sets it. A component, action or data provider name
 * registered twice is reported, and the later one wins; a handler named like
 * a built-in Admin action (`navigate`, `openDrawer`, `closeDrawer`) is refused
 * when the Admin is created.
 */
export function composeAdminExtensions(list: readonly AdminExtension[]): MountAdminExtensions {
  const components: Record<string, AdminExtensionComponent> = {}
  const actions: Record<string, AdminExtensionAction> = {}
  const merged: MountAdminExtensions = {}
  const listeners: NonNullable<MountAdminExtensions['onEvent']>[] = []
  const workspaceListeners: NonNullable<MountAdminExtensions['onWorkspaceChange']>[] = []
  for (const { components: added, actions: declared, handlers, dataProviders, authProviders, accessProviders, drawers, menuBadges, upload, agent, routes, onEvent, onWorkspaceChange, assistantCommands, assistantMentions, ...rest } of list) {
    for (const name of Object.keys(added ?? {})) {
      if (components[name] || name in adminCatalogDefinitions.components)
        console.warn(`[lumi-admin] an extension registers the "${name}" component again; the later one is used`)
    }
    Object.assign(components, added)
    Object.assign(merged, rest)
    if (onEvent)
      listeners.push(onEvent)
    if (onWorkspaceChange)
      workspaceListeners.push(onWorkspaceChange)
    if (assistantCommands || assistantMentions) {
      const { commands, mentions } = mergeAssistantAdditions(
        { commands: merged.assistantCommands, mentions: merged.assistantMentions },
        { commands: assistantCommands, mentions: assistantMentions },
      )
      merged.assistantCommands = commands
      merged.assistantMentions = mentions
    }
    if (declared)
      Object.assign(actions, declared)
    if (handlers) {
      for (const name of Object.keys(handlers)) {
        if (merged.handlers?.[name])
          console.warn(`[lumi-admin] two extensions register the "${name}" action; the later one is used`)
      }
      merged.handlers = { ...merged.handlers, ...handlers }
    }
    if (dataProviders) {
      for (const name of Object.keys(dataProviders)) {
        if (merged.dataProviders?.[name])
          console.warn(`[lumi-admin] two extensions register the "${name}" data provider; the later one is used`)
      }
      merged.dataProviders = { ...merged.dataProviders, ...dataProviders }
    }
    if (authProviders)
      merged.authProviders = { ...merged.authProviders, ...authProviders }
    if (accessProviders)
      merged.accessProviders = { ...merged.accessProviders, ...accessProviders }
    if (drawers)
      merged.drawers = { ...merged.drawers, ...drawers }
    if (menuBadges)
      merged.menuBadges = { ...merged.menuBadges, ...menuBadges }
    // Upload and agent options are several settings each; merge them field by field.
    if (upload)
      merged.upload = { ...merged.upload, ...upload }
    if (agent)
      merged.agent = { ...merged.agent, ...agent }
    if (routes)
      merged.routes = [...(merged.routes ?? []), ...routes]
  }
  // Every module's listener hears every event, in module order; one that
  // throws is reported and does not stop the others.
  if (listeners.length) {
    merged.onEvent = async (event) => {
      for (const listener of listeners) {
        try {
          await listener(event)
        }
        catch (error) {
          console.error(`[lumi-admin] an onEvent listener failed on "${event.name}"`, error)
        }
      }
    }
  }
  if (workspaceListeners.length) {
    merged.onWorkspaceChange = (value) => {
      for (const listener of workspaceListeners) {
        try {
          listener(value)
        }
        catch (error) {
          console.error('[lumi-admin] an onWorkspaceChange listener failed', error)
        }
      }
    }
  }
  const names = Object.keys(components)
  // Every extension action is in the catalog, defined or not, so a page that
  // calls it passes validation.
  const actionNames = [...new Set([...Object.keys(merged.handlers ?? {}), ...Object.keys(actions)])]
    .filter(name => !(name in adminCatalogDefinitions.actions))
  if (!names.length && !actionNames.length)
    return merged
  const actionDefinitions = Object.fromEntries(actionNames.map(name => [name, {
    params: actions[name]?.params ?? z.record(z.string(), z.unknown()),
    description: actions[name]?.description ?? name,
  }])) as Record<string, any>
  const definitions = Object.fromEntries(names.map(name => [name, {
    props: components[name]!.props ?? z.object({}),
    slots: components[name]!.slots ?? [],
    events: components[name]!.events ?? [],
    description: components[name]!.description ?? name,
  }])) as Record<string, any>
  const extensionCatalog = defineCatalog(schema, { components: definitions, actions: {} })
  const { registry } = defineRegistry(extensionCatalog, {
    components: Object.fromEntries(names.map(name => [name, components[name]!.render])) as never,
  })
  return {
    ...merged,
    catalog: defineCatalog(schema, {
      components: { ...adminCatalogDefinitions.components, ...definitions },
      actions: { ...adminCatalogDefinitions.actions, ...actionDefinitions },
    }),
    registry: { ...adminRegistry, ...registry } as ComponentRegistry,
  }
}
