import { Buffer } from 'node:buffer'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { isPackedDocument, packDocument, unpackDocument } from '../../src/catalog.js'

const page = {
  root: 'card',
  elements: { card: { type: 'Card', props: { title: '订单 — Orders', url: '/orders' }, children: [] } },
}

describe('packed documents', () => {
  it('round-trips a document without showing its text', async () => {
    const packed = await packDocument(page)
    expect(isPackedDocument(packed)).toBe(true)
    expect(Object.keys(packed)).toEqual(['packed'])
    expect(packed.packed).not.toContain('Card')
    expect(Buffer.from(packed.packed, 'base64').toString('latin1')).not.toContain('/orders')
    await expect(unpackDocument(packed)).resolves.toEqual(page)
  })

  it('masks with a key, and refuses the wrong or a missing one', async () => {
    const packed = await packDocument(page, { key: 's3cret' })
    expect(packed.packed).not.toBe((await packDocument(page)).packed)
    await expect(unpackDocument(packed, { key: 's3cret' })).resolves.toEqual(page)
    await expect(unpackDocument(packed, { key: 'other' })).rejects.toThrow('could not be unpacked')
    await expect(unpackDocument(packed)).rejects.toThrow('could not be unpacked')
  })

  it('reads what a server produces with a standard raw deflate', async () => {
    const key = Buffer.from('钥匙-key')
    const bytes = deflateRawSync(Buffer.from(JSON.stringify(page)))
    bytes.forEach((byte, index) => {
      bytes[index] = byte ^ key[index % key.length]!
    })
    await expect(unpackDocument({ packed: bytes.toString('base64') }, { key: '钥匙-key' })).resolves.toEqual(page)
  })

  it('round-trips a document larger than one chunk', async () => {
    const rows = Array.from({ length: 5000 }, (_, index) => ({ id: index, label: `Row ${index} ${Math.sin(index)}` }))
    await expect(unpackDocument(await packDocument(rows, { key: 'k' }), { key: 'k' })).resolves.toEqual(rows)
  })

  it('recognises only the exact envelope', () => {
    expect(isPackedDocument({ packed: 'abc' })).toBe(true)
    expect(isPackedDocument({ packed: 'abc', root: 'x' })).toBe(false)
    expect(isPackedDocument({ packed: 1 })).toBe(false)
    expect(isPackedDocument(['packed'])).toBe(false)
    expect(isPackedDocument(null)).toBe(false)
    expect(isPackedDocument(page)).toBe(false)
  })

  it('refuses text that is not packed data', async () => {
    await expect(unpackDocument({ packed: 'not base64 !!' })).rejects.toThrow('could not be unpacked')
    await expect(unpackDocument({ packed: Buffer.from('plain text').toString('base64') })).rejects.toThrow('could not be unpacked')
  })
})
