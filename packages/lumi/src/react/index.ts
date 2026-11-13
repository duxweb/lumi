import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { lumiActionDefinitions, lumiComponentDefinitions } from '../catalog/index.js'
import { AgentSession } from './agent.js'
import { CanAccess } from './can-access.js'
import { Query } from './query-component.js'

export const lumiCatalog = defineCatalog(schema, { components: lumiComponentDefinitions, actions: lumiActionDefinitions })
// Service handlers need host context and are supplied separately by createLumiHandlers.
const componentCatalog = defineCatalog(schema, { components: lumiComponentDefinitions, actions: {} })
// The JSON elements (CanAccess, Query, AgentSession) are reached through the
// registry; JSX uses LumiCanAccess and the hooks.
export const { registry: lumiRegistry } = defineRegistry(componentCatalog, { components: { CanAccess, Query, AgentSession } })
export { useAgentApprovalMode, useAgentChat } from './agent.js'
export type { AgentChat, UseAgentChatOptions } from './agent.js'
export * from './audit.js'
export { browserTransferHost } from './browser-files.js'
export { LumiCanAccess } from './can-access.js'
export type { LumiCanAccessProps } from './can-access.js'
export * from './context.js'
export { LumiDataProviderScope, useDataProviderName } from './data-scope.js'
export * from './data.js'
export * from './form.js'
export * from './live.js'
export * from './options.js'
export * from './overlay.js'
export * from './providers.js'
export * from './query.js'

export * from './select.js'
export * from './spec-page.js'
export * from './table.js'
export * from './tenant.js'
export * from './transfer.js'
export * from './tree.js'
export * from './upload.js'
export * from './validator.js'
