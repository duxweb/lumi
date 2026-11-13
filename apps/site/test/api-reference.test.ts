import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('generated API reference', () => {
  it('contains the published UI and Admin packages', async () => {
    const source = await readFile(new URL('../src/docs/generated/api-reference.json', import.meta.url), 'utf8')
    expect(source).toContain('@duxweb/lumi-ui')
    expect(source).toContain('@duxweb/lumi-admin')
  })
})
