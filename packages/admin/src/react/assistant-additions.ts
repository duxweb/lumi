import type { AgentCommand } from '@duxweb/lumi-ui'
import type { AdminPromptMentions } from './agent-mention.js'

/** What extension modules add to the manifest's assistant: more / commands and @ tabs. */
export interface AdminAssistantAdditions {
  commands?: readonly AgentCommand[]
  mentions?: AdminPromptMentions
}

/**
 * The earlier commands and @ tabs followed by the later ones; a later tab,
 * command or option with the same value (an option: of the same kind)
 * replaces the earlier one, and sources
 * merge by type.
 */
export function mergeAssistantAdditions(earlier: AdminAssistantAdditions, later: AdminAssistantAdditions = {}): { commands: AgentCommand[], mentions: AdminPromptMentions | undefined } {
  const unique = <T>(list: readonly T[], key: (item: T) => string): T[] => [...new Map(list.map(item => [key(item), item])).values()]
  const commands = unique([...(earlier.commands ?? []), ...(later.commands ?? [])], item => item.value)
  const types = unique([...(earlier.mentions?.types ?? []), ...(later.mentions?.types ?? [])], item => item.value)
  // Two kinds may share a record id, so an option is known by kind and value.
  const options = unique([...(earlier.mentions?.options ?? []), ...(later.mentions?.options ?? [])], item => `${item.type ?? ''}:${item.value}`)
  const sources = { ...earlier.mentions?.sources, ...later.mentions?.sources }
  const mentions = types.length || options.length
    ? { ...earlier.mentions, ...later.mentions, types, ...(options.length ? { options } : {}), ...(Object.keys(sources).length ? { sources } : {}) }
    : undefined
  return { commands, mentions }
}
