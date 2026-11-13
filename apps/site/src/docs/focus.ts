import type { Spec } from '@json-render/core'

/** Top-level state keys the elements point at through `$bindState`, `$state` or `statePath`. */
function referencedStateKeys(elements: Spec['elements']): Set<string> {
  const keys = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith('/'))
      keys.add(value.slice(1).split('/')[0]!)
    else if (Array.isArray(value))
      value.forEach(visit)
    else if (value && typeof value === 'object')
      Object.values(value).forEach(visit)
  }
  visit(Object.values(elements).map(element => [element.props, element.on, element.visible, element.watch]))
  return keys
}

export function focusComponentDemo(spec: Spec, component: string | null): Spec | undefined {
  if (!component)
    return spec
  const match = Object.entries(spec.elements).find(([, element]) => element.type === component || (element.type === 'FormField' && element.props.widget === component))
  if (!match)
    return undefined
  const [root] = match
  const elements: Spec['elements'] = {}
  const collect = (key: string): void => {
    if (elements[key] || !spec.elements[key])
      return
    elements[key] = spec.elements[key]!
    for (const child of [...elements[key].children ?? [], ...Object.values(elements[key].slots ?? {}).flat()]) collect(child)
  }
  collect(root)
  const rootProps = { ...elements[root]!.props }
  if (component === 'Dialog' || component === 'Drawer' || component === 'Lightbox')
    rootProps.open = true
  elements[root] = { ...elements[root]!, props: rootProps }
  // Keep only the state this example reads: the gallery page holds every demo's data.
  const used = referencedStateKeys(elements)
  const state = structuredClone(Object.fromEntries(Object.entries(spec.state ?? {}).filter(([key]) => used.has(key))))
  return Object.keys(state).length ? { ...spec, root, elements, state } : { root, elements }
}
