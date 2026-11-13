export interface SkuAttribute {
  name: string
  values: string[]
}

export interface SkuVariant {
  /** Stable identity of the combination, e.g. `Color:Red|Size:S`. */
  key: string
  options: Record<string, string>
  price?: number | null
  stock?: number | null
  sku?: string
  [field: string]: unknown
}

export interface SkuValue {
  attributes: SkuAttribute[]
  variants: SkuVariant[]
}

/** Attributes that take part in the matrix: named, with at least one value. */
export function activeAttributes(attributes: readonly SkuAttribute[]): SkuAttribute[] {
  const seen = new Set<string>()
  return attributes.flatMap((attribute) => {
    const name = attribute.name.trim()
    const values = [...new Set(attribute.values.map(value => value.trim()).filter(Boolean))]
    if (!name || !values.length || seen.has(name))
      return []
    seen.add(name)
    return [{ name, values }]
  })
}

/** Every combination of the active attributes' values, in attribute order. */
export function skuCombinations(attributes: readonly SkuAttribute[]): Record<string, string>[] {
  const active = activeAttributes(attributes)
  if (!active.length)
    return []
  return active.reduce<Record<string, string>[]>(
    (combos, attribute) => combos.flatMap(combo => attribute.values.map(value => ({ ...combo, [attribute.name]: value }))),
    [{}],
  )
}

/** The stable key of a SKU variant: its options as `name:value|name:value`. */
export function variantKey(options: Record<string, string>): string {
  return Object.entries(options).map(([name, value]) => `${name}:${value}`).join('|')
}

function agreement(previous: Record<string, string>, next: Record<string, string>): number {
  let shared = 0
  for (const [name, value] of Object.entries(next)) {
    if (!(name in previous))
      continue
    if (previous[name] !== value)
      return -1
    shared += 1
  }
  return shared
}

/**
 * Regenerates the variant rows for `attributes`, carrying the entered price,
 * stock and fields over from `previous` where a combination survives. A row
 * whose attribute set changed inherits from the closest old row that agrees on
 * every shared attribute; the `sku` code is only inherited once, so codes stay unique.
 * `defaults` fills the fields a row did not inherit.
 */
export function buildSkuVariants(attributes: readonly SkuAttribute[], previous: readonly SkuVariant[] = [], defaults: Record<string, unknown> = { price: null, stock: null }): SkuVariant[] {
  const byKey = new Map(previous.map(variant => [variant.key, variant]))
  const combos = skuCombinations(attributes)
  // Codes of rows that survive unchanged stay with them.
  const usedCodes = new Set(combos.flatMap((options) => {
    const sku = byKey.get(variantKey(options))?.sku
    return typeof sku === 'string' && sku ? [sku] : []
  }))
  return combos.map((options) => {
    const key = variantKey(options)
    const exact = byKey.get(key)
    let source = exact
    if (!source) {
      let best = 0
      for (const candidate of previous) {
        const score = agreement(candidate.options ?? {}, options)
        if (score > best) {
          best = score
          source = candidate
        }
      }
    }
    const { key: _key, options: _options, sku, ...fields } = source ?? {}
    const code = typeof sku !== 'string' || !sku ? '' : exact ? sku : usedCodes.has(sku) ? '' : sku
    if (code)
      usedCodes.add(code)
    const inherited = Object.fromEntries(Object.entries(fields).filter(([, field]) => field !== undefined))
    return { ...structuredClone(defaults), ...inherited, sku: code, key, options }
  })
}
