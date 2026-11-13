export interface UploadResult {
  /** Where the stored file is read from. */
  url: string
  /** The file's name; the local file's when the backend gives none. */
  name?: string
  /** Size in bytes. */
  size?: number
  /** MIME type. */
  type?: string
  /** The backend's whole answer. */
  raw?: unknown
}

/** A refused upload, with the status and the backend's answer. */
export class UploadError extends Error {
  status: number
  data: unknown
  raw: unknown

  constructor(payload: { status: number, message: string, data?: unknown, raw?: unknown }) {
    super(payload.message)
    this.name = 'UploadError'
    this.status = payload.status
    this.data = payload.data
    this.raw = payload.raw
  }
}

export type UploadHeaders = Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)

/**
 * Direct-to-storage upload (S3, OSS, COS, R2, MinIO…): the file never passes
 * through the backend. The backend is asked for a ticket, the file goes to
 * the address the ticket names, and the backend may be told when it is there.
 */
export interface UploadSignOptions {
  /** Where the ticket is asked for, relative to the API root. Sent `{ name, size, type, ...data }` as JSON; answers an `UploadTicket` (in `data`). */
  url: string
  /** Extra values of the ticket request, e.g. `{ "folder": "avatars" }`. */
  data?: Record<string, unknown>
  /**
   * Called once the storage accepted the file, relative to the API root: sent
   * `{ name, size, type, ...ticket.complete }`, and what it answers
   * (`{ data: { url, name?, size?, type? } }`) is the upload's result.
   */
  complete?: string
}

/** What the backend answers a ticket request with. */
export interface UploadTicket {
  /** Where the file goes: a presigned URL, or the bucket's form endpoint. */
  url: string
  /** `PUT` sends the file as the body (presigned URL); `POST` sends a form (policy upload). Defaults to `POST` with `fields`, else `PUT`. */
  method?: 'PUT' | 'POST'
  /** Headers the storage expects, e.g. `Content-Type` or `x-amz-acl`; they must match what was signed. */
  headers?: Record<string, string>
  /** Form fields of a `POST` upload (key, policy, signature…), sent before the file. */
  fields?: Record<string, string>
  /** Form field of the file in a `POST` upload; defaults to `file`. */
  fieldName?: string
  /** The address the file will be read from; needed unless `complete` answers it. */
  fileUrl?: string
  /** Values handed back to the `complete` request, e.g. the object key. */
  complete?: Record<string, unknown>
}

export interface UploadOptions {
  /** Aborts the upload. */
  signal?: AbortSignal
  /** Uploads straight to object storage with a ticket from the backend, instead of through `url`. */
  sign?: UploadSignOptions
  /** Where the file is sent, relative to the API root; `/upload` by default. */
  url?: string
  /** `POST` by default. */
  method?: 'POST' | 'PUT' | 'PATCH'
  /** Form field of the file; `file` by default. */
  fieldName?: string
  /** Other form fields sent beside the file. */
  data?: Record<string, unknown>
  /** Extra headers, or a function answering them; the reader's credentials are added by the request client. */
  headers?: UploadHeaders
  /** Sends cookies; follows the auth provider's credentials when left out. */
  withCredentials?: boolean
  /** The data provider whose API root and request client are used. */
  dataProviderName?: string
  /** Other sites an upload `url` may point at and be signed for; the API root and this site always are. */
  trustedOrigins?: string[]
}

/** Upload headers as an object, calling them when they are a function. */
export async function resolveUploadHeaders(headers: UploadHeaders | undefined): Promise<Record<string, string>> {
  if (!headers)
    return {}
  return typeof headers === 'function' ? await headers() : headers
}

/** Merges upload options: the later ones override the earlier, except headers, where the earlier win, and `trustedOrigins`, which add up. */
export function mergeUploadOptions(
  injected: UploadOptions,
  defaults: UploadOptions,
  overrides: UploadOptions,
): UploadOptions {
  return {
    ...injected,
    ...defaults,
    ...overrides,
    trustedOrigins: [
      ...(injected.trustedOrigins ?? []),
      ...(defaults.trustedOrigins ?? []),
      ...(overrides.trustedOrigins ?? []),
    ],
    headers: async () => ({
      ...await resolveUploadHeaders(overrides.headers),
      ...await resolveUploadHeaders(defaults.headers),
      ...await resolveUploadHeaders(injected.headers),
    }),
  }
}
