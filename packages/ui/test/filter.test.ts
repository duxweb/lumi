import { filterConditionsToModel } from '@duxweb/lumi-ui/catalog'
import { describe, expect, it } from 'vitest'

describe('filter model conversion', () => {
  it('aggregates range bounds without losing either condition', () => {
    expect(filterConditionsToModel([
      { field: 'created', op: 'gte', value: '2026-08-01' },
      { field: 'created', op: 'lte', value: '2026-08-10' },
      { field: 'amount', op: 'lte', value: 500 },
      { field: 'amount', op: 'gte', value: 100 },
    ])).toEqual({
      created: ['2026-08-01', '2026-08-10'],
      amount: [100, 500],
    })
  })
})
