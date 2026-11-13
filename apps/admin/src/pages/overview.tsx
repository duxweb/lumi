import type { ComponentOverviewEntry } from '@duxweb/lumi-schema-gallery'
import type { Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import { LumiSpecSource, useTranslate } from '@duxweb/lumi'
import { adminRegistry, LumiCardList, LumiPage, LumiPageHeader, LumiPreviewCard } from '@duxweb/lumi-admin'
import { COMPONENT_OVERVIEW } from '@duxweb/lumi-schema-gallery'
import { LumiInput as Input, LumiTagSelect as TagSelect } from '@duxweb/lumi-ui'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { memo, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { CAPABILITIES } from '../capabilities.js'

type Translate = ReturnType<typeof useTranslate>

const ALL = 'all'
// Props that carry reading text; values, keys and data fields stay as authored.
const TEXT_PROPS = new Set(['label', 'title', 'description', 'placeholder', 'text', 'message', 'help', 'caption', 'content', 'summary', 'empty', 'emptyLabel', 'hint', 'confirmText', 'cancelText', 'sourceTitle', 'targetTitle', 'allLabel', 'action', 'context', 'addLabel', 'coverLabel'])

/** Thumbnails are authored in English for any host; this one reads them through its own messages. */
function localize(value: unknown, t: Translate, key?: string): unknown {
  if (typeof value === 'string')
    return key && TEXT_PROPS.has(key) ? t(value, undefined, value) : value
  if (Array.isArray(value))
    return value.map(item => localize(item, t, key))
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, localize(item, t, name)]))
  return value
}

function localizeSpec(spec: Spec, t: Translate): Spec {
  return { ...spec, elements: Object.fromEntries(Object.entries(spec.elements).map(([key, element]) => [key, { ...element, props: localize(element.props, t) as Record<string, unknown> }])) }
}

// Filtering re-renders the list; a thumbnail renders again only when the locale changes.
const Thumbnail = memo(({ entry }: { entry: ComponentOverviewEntry }): ReactElement => {
  const t = useTranslate()
  const spec = useMemo(() => localizeSpec(entry.spec, t), [entry.spec, t])
  return (
    <LumiSpecSource spec={spec}>
      <JSONUIProvider registry={adminRegistry} initialState={spec.state}>
        <Renderer spec={spec} registry={adminRegistry} />
      </JSONUIProvider>
    </LumiSpecSource>
  )
})

/** A category's label is its showcase menu group, so the overview and the menu name it alike. */
function categoryLabel(name: string): string {
  return CAPABILITIES.find(item => item.group.name === name)?.group.label ?? COMPONENT_OVERVIEW.categories.find(category => category.name === name)?.label ?? name
}

export function AdminComponentOverviewRoute(): ReactElement {
  const t = useTranslate()
  // The query and category live in the URL, so a filtered view can be linked and survives Back.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const category = params.get('category') ?? ALL
  const update = (name: string, value: string): void => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value && value !== ALL)
      next.set(name, value)
    else
      next.delete(name)
    return next
  }, { replace: true })
  const label = (name: string): string => t(`demo.${categoryLabel(name)}`, undefined, categoryLabel(name))
  const query = search.trim().toLowerCase()
  const matching = COMPONENT_OVERVIEW.components.filter(entry => !query || [entry.name, entry.description, t(entry.description), label(entry.category)].some(text => text.toLowerCase().includes(query)))
  const visible = category === ALL ? matching : matching.filter(entry => entry.category === category)
  const options = [
    { value: ALL, label: t('All'), count: matching.length },
    ...COMPONENT_OVERVIEW.categories.map(item => ({ value: item.name, label: label(item.name), count: matching.filter(entry => entry.category === item.name).length })),
  ]
  return (
    <LumiPage stack>
      <LumiPageHeader
        title={t('Component overview')}
        description={t('Every Lumi component as a live miniature. Open one for its examples and their native Spec')}
        actions={<Input ariaLabel={t('Search components')} placeholder={t('Search components…')} value={search} onChange={value => update('q', String(value ?? ''))} clearable />}
      />
      <TagSelect ariaLabel={t('Component categories')} options={options} value={category} onChange={value => update('category', typeof value === 'string' ? value : ALL)} />
      <LumiCardList
        ariaLabel={t('Components')}
        items={visible}
        minItemWidth={300}
        getKey={entry => entry.name}
        renderItem={entry => (
          <LumiPreviewCard
            title={entry.name}
            description={t(entry.description)}
            badge={label(entry.category)}
            href={entry.href}
            previewScale={entry.scale}
            preview={<Thumbnail entry={entry} />}
          />
        )}
        empty={{ title: t('No components match your search'), reason: t('No component name or description matches that text'), nextStep: t('Try “Input”, “Table” or “Dialog”') }}
      />
    </LumiPage>
  )
}
