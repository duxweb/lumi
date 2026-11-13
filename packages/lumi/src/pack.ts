/**
 * Packed documents: a page, manifest or theme sent as `{ "packed": "…" }`
 * instead of readable JSON, so its text does not show in a browser's network
 * panel. The value is the JSON text, raw-deflated, masked with a key when one
 * is set, and written as base64.
 *
 * This hides a document from a casual look, nothing more: the browser unpacks
 * it, so a reader who steps through the page still reaches it. What a reader
 * must not learn has to stay on the server.
 */
export interface PackedDocument {
  packed: string
}

export interface PackOptions {
  /** Masks the deflated bytes, so a generic inflate tool cannot read them. Both sides use the same key. */
  key?: string
}

/** A document unpacks to at most this many bytes of JSON text; a larger one is refused. */
export const MAX_UNPACKED_BYTES = 16 * 1024 * 1024

const FORMAT = 'deflate-raw'
const CHUNK = 0x8000

/** Whether `value` is exactly `{ "packed": "<text>" }`. */
export function isPackedDocument(value: unknown): value is PackedDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === 'packed' && typeof (value as PackedDocument).packed === 'string'
}

/** XORs `bytes` in place with the key's UTF-8 bytes, repeated; the same call masks and unmasks. */
function mask(bytes: Uint8Array, key: string | undefined): Uint8Array {
  const secret = key ? new TextEncoder().encode(key) : undefined
  if (secret?.length) {
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = bytes[index]! ^ secret[index % secret.length]!
  }
  return bytes
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Everything `stream` yields, refusing more than `limit` bytes. */
async function collect(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('too large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

function through(bytes: Uint8Array, transform: GenericTransformStream): ReadableStream<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  return source.pipeThrough(transform as ReadableWritablePair<Uint8Array, Uint8Array>)
}

/** Packs any JSON value; a server written in another language follows the same three steps. */
export async function packDocument(value: unknown, options: PackOptions = {}): Promise<PackedDocument> {
  const text = new TextEncoder().encode(JSON.stringify(value))
  const deflated = await collect(through(text, new CompressionStream(FORMAT)), Number.POSITIVE_INFINITY)
  return { packed: toBase64(mask(deflated, options.key)) }
}

/** The JSON value a packed document holds. Throws when the key is wrong or the data is damaged. */
export async function unpackDocument(document: PackedDocument, options: PackOptions = {}): Promise<unknown> {
  try {
    const deflated = mask(fromBase64(document.packed), options.key)
    const text = await collect(through(deflated, new DecompressionStream(FORMAT)), MAX_UNPACKED_BYTES)
    return JSON.parse(new TextDecoder().decode(text)) as unknown
  }
  catch (error) {
    throw new Error('[lumi] packed document could not be unpacked: the key is wrong or the data is damaged', { cause: error })
  }
}
