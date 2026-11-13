import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('react guide', () => {
  it('uses the final adapter and neutral value vocabulary', async () => {
    const guide = await readFile(new URL('../src/content/docs/guide/advanced/react.mdx', import.meta.url), 'utf8')
    expect(guide).toContain('@duxweb/lumi-ui')
    expect(guide).not.toContain('lumi-ui-hero')
    expect(guide).not.toContain('modelValue')
  })
})
