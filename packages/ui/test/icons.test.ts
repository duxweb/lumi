import { describe, expect, it } from 'vitest'
import { hugeiconsExportName, loadOutlineIcon } from '../src/icons.js'

describe('icons by name', () => {
  it('maps kebab and prefixed names to HugeIcons exports', () => {
    expect(hugeiconsExportName('delivery-truck-01')).toBe('DeliveryTruck01Icon')
    expect(hugeiconsExportName('hugeicons:user-group')).toBe('UserGroupIcon')
    expect(hugeiconsExportName('DeliveryTruck01Icon')).toBe('DeliveryTruck01Icon')
  })

  it('loads icons outside the bundled set and rejects unknown names', async () => {
    expect(await loadOutlineIcon('delivery-truck-01')).toBeDefined()
    expect(await loadOutlineIcon('search')).toBeDefined()
    expect(await loadOutlineIcon('no-such-icon-anywhere')).toBeUndefined()
    expect(await loadOutlineIcon('constructor')).toBeUndefined()
  })
})
