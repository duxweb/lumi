import type { AgentCommand } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { AdminAssistant } from '../config.js'
import type { AdminAssistantAdditions } from './assistant-additions.js'
import { useTranslate } from '@duxweb/lumi'
import { useMemo } from 'react'
import { mergeAssistantAdditions } from './assistant-additions.js'
import { useShellEventEmitter } from './components/ShellContext.js'
import { LumiAgentPanel } from './pages/LumiAgentPanel.js'

/**
 * The assistant panel the manifest's `app.assistant` describes. Labels go
 * through the translator, so they can be message keys. A command without a
 * `prompt` reaches the `onEvent` listeners as `assistant.command`.
 */
export function AdminManifestAssistant({ config, additions }: { config: AdminAssistant, additions?: AdminAssistantAdditions | undefined }): ReactElement {
  const t = useTranslate()
  const emit = useShellEventEmitter()
  const { commands, mentions } = useMemo(() => mergeAssistantAdditions(config, additions), [config, additions])
  return (
    <LumiAgentPanel
      endpoint={config.endpoint}
      {...(config.resource ? { resource: config.resource } : {})}
      {...(config.title ? { title: t(config.title) } : {})}
      {...(config.placeholder ? { placeholder: t(config.placeholder) } : {})}
      {...(config.shareContext === undefined ? {} : { shareContext: config.shareContext })}
      {...(config.suggestions?.length
        ? { suggestions: config.suggestions.map(item => ({ key: item.id ?? item.label, label: t(item.label), ...(item.prompt ? { prompt: t(item.prompt) } : {}), ...(item.icon ? { icon: item.icon } : {}) })) }
        : {})}
      {...(mentions ? { mentions: { ...mentions, types: mentions.types?.map(type => ({ ...type, label: t(type.label) })) } } : {})}
      {...(commands.length
        ? {
            commands: commands.map(command => ({
              ...command,
              label: t(command.label),
              ...(command.description ? { description: t(command.description) } : {}),
              ...(command.prompt ? { prompt: t(command.prompt) } : {}),
            })),
            onCommand: (command: AgentCommand) => {
              void emit?.({ name: 'assistant.command', payload: { command: command.value, label: command.label } })
            },
          }
        : {})}
    />
  )
}
