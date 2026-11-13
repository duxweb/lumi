import type { DragEvent, KeyboardEvent, ReactElement, MouseEvent as ReactMouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import type { ControlAppearance, ImageGridItem, ImageGridProps, Size, UploadProps } from '../catalog/types-public.js'
import type { UiText } from './text.js'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircleIcon, CheckCircleIcon, CloudUploadIcon, EyeIcon, FileIcon, ImageIcon, RefreshIcon, StarIcon, TrashIcon, UploadIcon, XIcon } from '../icons.js'
import { formatFileSize } from '../internal/file-size.js'
import { Badge } from '../internal/shadcn/badge.js'
import { Button } from '../internal/shadcn/button.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { LumiTooltip } from './interactive.js'
import { LumiLightbox } from './media.js'
import { moveRow } from './repeater.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'children'?: ReactNode
  'id'?: string
  'name'?: string
  'appearance'?: ControlAppearance
  'size'?: Size
  'required'?: boolean
  'aria-describedby'?: string
  'data-testid'?: string
}

const IMAGE_DATA_OR_BLOB = /^(?:blob:|data:image\/)/
const IMAGE_FILE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const ARCHIVE_EXTENSION = /\.(?:7z|gz|rar|tar|tgz|zip)$/i
const DOCUMENT_EXTENSION = /\.(?:csv|docx?|md|pdf|pptx?|rtf|txt|xlsx?)$/i
const MIME_SUFFIX = /^(?:.*[.+])?([^.+]+)$/
const URL_SUFFIX = /[?#]/
const EXTENSION = /\.([a-z0-9]{1,8})$/i

/**
 * The same test the file picker applies through `accept`. Dropped files skip
 * the picker, so they are checked here: `.ext`, `type/*` and exact MIME types.
 */
export function matchesAccept(file: { name: string, type?: string }, accept?: string): boolean {
  if (!accept)
    return true
  const name = file.name.toLowerCase()
  const type = (file.type ?? '').toLowerCase()
  return accept.split(',').map(token => token.trim().toLowerCase()).filter(Boolean).some((token) => {
    if (token.startsWith('.'))
      return name.endsWith(token)
    if (token.endsWith('/*'))
      return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

function acceptLabel(accept: string | undefined, t: UiText['t']): string | undefined {
  if (!accept)
    return undefined
  const labels = accept.split(',').map(token => token.trim().toLowerCase()).filter(Boolean).map((token) => {
    if (token === 'image/*')
      return t('lumi.upload.typeImages', 'Images')
    if (token === 'video/*')
      return t('lumi.upload.typeVideos', 'Videos')
    if (token === 'audio/*')
      return t('lumi.upload.typeAudio', 'Audio')
    if (token.startsWith('.'))
      return token.slice(1).toUpperCase()
    if (token === 'text/plain')
      return 'TXT'
    return (MIME_SUFFIX.exec(token.split('/')[1] ?? token)?.[1] ?? token).toUpperCase()
  })
  return [...new Set(labels)].join(', ')
}

type FileKind = 'image' | 'document' | 'archive' | 'video' | 'audio' | 'other'

function fileKind(name: string, type?: string): FileKind {
  if (type?.startsWith('image/') || IMAGE_FILE_EXTENSION.test(name) || IMAGE_DATA_OR_BLOB.test(name))
    return 'image'
  if (type?.startsWith('video/'))
    return 'video'
  if (type?.startsWith('audio/'))
    return 'audio'
  if (ARCHIVE_EXTENSION.test(name))
    return 'archive'
  if (DOCUMENT_EXTENSION.test(name) || type === 'application/pdf' || type?.startsWith('text/'))
    return 'document'
  return 'other'
}

function fileName(url: string): string {
  const last = url.split(URL_SUFFIX)[0]!.split('/').pop() || url
  try {
    return decodeURIComponent(last)
  }
  catch {
    return last
  }
}

function isAbort(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError'
}

function reason(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export { formatFileSize }

function objectUrl(file: File): string | undefined {
  return file.type.startsWith('image/') && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined
}

function revoke(url: string | undefined): void {
  if (url?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function')
    URL.revokeObjectURL(url)
}

/** A file that is not in `value` yet: it is uploading, or it failed or was refused. */
interface PendingFile {
  id: string
  file: File
  status: 'uploading' | 'error'
  progress?: number | undefined
  error?: string | undefined
  /** Refused before sending (type, size, count): trying again cannot help. */
  refused?: boolean | undefined
  preview?: string | undefined
  controller?: AbortController | undefined
}

interface FileMeta { name: string, size?: number, type?: string, preview?: string | undefined }

let pendingSeq = 0

interface UploadQueueOptions {
  accept?: string | undefined
  maxSize?: number | undefined
  /** The count a refusal for lack of room names. */
  limit?: number | undefined
  /** A new file replaces the last one, aborting whatever is still sending. */
  single?: boolean | undefined
  /** How many more files fit, given the ones already in flight. */
  room: (inFlight: number) => number
  /** The URLs in the value now; a finished file's preview is freed once its URL leaves. */
  kept: readonly string[]
  onUpload?: UploadProps['onUpload']
  onUploadFile?: UploadProps['onUploadFile']
  onCancel?: (() => void) | undefined
  /** URLs of finished files, in the order they finished. */
  onUploaded: (urls: string[]) => void
  /** Accepted files when there is no upload handler to send them. */
  onUnsent: (accepted: PendingFile[]) => void
}

interface UploadQueue {
  pending: PendingFile[]
  /** A batch `onUpload` is running; the field takes no new files until it ends. */
  batchBusy: boolean
  /** Name, size, type and local preview of the files uploaded here, by URL. */
  meta: Map<string, FileMeta>
  add: (files: File[]) => void
  cancel: (item: PendingFile) => void
  retry: (item: PendingFile) => void
  dismiss: (ids: string[]) => void
}

/**
 * The file side of Upload and ImageGrid: checks each file against `accept`,
 * size and room, then sends it with its own progress, cancel and retry. Only
 * finished URLs leave through `onUploaded`; failures stay here until dismissed.
 */
function useUploadQueue(options: UploadQueueOptions): UploadQueue {
  const { t } = useUiText()
  const [pending, setPending] = useState<PendingFile[]>([])
  const [batchBusy, setBatchBusy] = useState(false)
  const pendingRef = useRef(pending)
  const meta = useRef(new Map<string, FileMeta>())
  const latest = useRef(options)
  pendingRef.current = pending
  latest.current = options

  const keptKey = options.kept.join('\n')
  useEffect(() => {
    const kept = new Set(keptKey.split('\n'))
    for (const [url, item] of meta.current) {
      if (!kept.has(url)) {
        revoke(item.preview)
        meta.current.delete(url)
      }
    }
  }, [keptKey])

  useEffect(() => () => {
    for (const item of pendingRef.current) {
      item.controller?.abort()
      revoke(item.preview)
    }
    for (const item of meta.current.values())
      revoke(item.preview)
  }, [])

  const patch = (key: string, next: Partial<PendingFile>): void =>
    setPending(current => current.map(item => item.id === key ? { ...item, ...next } : item))
  const dismiss = (keys: string[], keepPreview = false): void => {
    setPending(current => current.filter((item) => {
      if (!keys.includes(item.id))
        return true
      if (!keepPreview)
        revoke(item.preview)
      return false
    }))
  }
  const finish = (urls: string[], batch: PendingFile[]): void => {
    urls.forEach((url, index) => {
      const item = batch[index]
      if (item)
        meta.current.set(url, { name: item.file.name, size: item.file.size, type: item.file.type, preview: item.preview })
    })
    dismiss(batch.map(item => item.id), true)
    if (urls.length)
      latest.current.onUploaded(urls)
  }

  const sendOne = async (item: PendingFile): Promise<void> => {
    const upload = latest.current.onUploadFile
    if (!upload)
      return
    const controller = new AbortController()
    patch(item.id, { status: 'uploading', progress: 0, error: undefined, controller })
    try {
      const url = await upload(item.file, {
        signal: controller.signal,
        onProgress: percent => !controller.signal.aborted && patch(item.id, { progress: Math.round(percent) }),
      })
      if (!controller.signal.aborted)
        finish([url], [item])
    }
    catch (cause) {
      // Only our own cancel is silent: an abort from the transport is a failure the reader can retry.
      if (!controller.signal.aborted)
        patch(item.id, { status: 'error', error: reason(cause), controller: undefined })
    }
  }
  const sendBatch = async (batch: PendingFile[]): Promise<void> => {
    const upload = latest.current.onUpload
    if (!upload)
      return
    const keys = batch.map(item => item.id)
    setPending(current => current.map(item => keys.includes(item.id) ? { ...item, status: 'uploading', error: undefined } : item))
    setBatchBusy(true)
    try {
      finish(await upload(batch.map(item => item.file)), batch)
    }
    catch (cause) {
      if (isAbort(cause))
        dismiss(keys)
      else setPending(current => current.map(item => keys.includes(item.id) ? { ...item, status: 'error', error: reason(cause) } : item))
    }
    finally {
      setBatchBusy(false)
    }
  }
  const send = (batch: PendingFile[]): void => {
    if (!batch.length)
      return
    if (latest.current.onUploadFile)
      batch.forEach(item => void sendOne(item))
    else if (latest.current.onUpload)
      void sendBatch(batch)
  }

  const add = (selected: File[]): void => {
    const { accept, maxSize, limit, single, room, onUpload, onUploadFile } = latest.current
    if (!selected.length)
      return
    const inFlight = pendingRef.current.filter(item => item.status === 'uploading').length
    const space = single ? 1 : room(inFlight)
    const accepted: PendingFile[] = []
    const refused: PendingFile[] = []
    for (const file of single ? selected.slice(0, 1) : selected) {
      const base = { id: `upload-${++pendingSeq}`, file }
      const problem = !matchesAccept(file, accept)
        ? t('lumi.upload.typeNotAllowed', 'This file type is not accepted')
        : maxSize !== undefined && file.size > maxSize
          ? t('lumi.upload.tooLarge', 'Larger than {size}', { size: formatFileSize(maxSize) })
          : accepted.length >= space
            ? t('lumi.upload.tooMany', 'Only {count} files allowed', { count: limit ?? 1 })
            : undefined
      if (problem)
        refused.push({ ...base, status: 'error', error: problem, refused: true })
      else accepted.push({ ...base, status: 'uploading', progress: onUploadFile ? 0 : undefined, preview: objectUrl(file) })
    }
    if (!onUploadFile && !onUpload) {
      setPending(current => [...(single ? [] : current.filter(item => item.status === 'uploading')), ...refused])
      latest.current.onUnsent(accepted)
      return
    }
    // A new file replaces the one being sent; a refused one (too large, wrong
    // type) only shows its reason and leaves that upload running.
    const replaces = single && accepted.length > 0
    if (replaces) {
      for (const item of pendingRef.current) {
        item.controller?.abort()
        revoke(item.preview)
      }
    }
    setPending(current => [...(replaces ? [] : current), ...refused, ...accepted])
    send(accepted)
  }

  return {
    pending,
    batchBusy,
    meta: meta.current,
    add,
    cancel: (item) => {
      if (item.controller) {
        item.controller.abort()
        dismiss([item.id])
        return
      }
      latest.current.onCancel?.()
    },
    retry: (item) => {
      // Its slot may have gone to another file since it failed.
      const { single, room, limit } = latest.current
      if (!single && room(pendingRef.current.filter(entry => entry.status === 'uploading').length) < 1) {
        patch(item.id, { error: t('lumi.upload.tooMany', 'Only {count} files allowed', { count: limit ?? 1 }) })
        return
      }
      if (latest.current.onUploadFile)
        void sendOne(item)
      else if (latest.current.onUpload)
        void sendBatch([item])
    },
    dismiss: ids => dismiss(ids),
  }
}

function ProgressBar({ value, label }: { value?: number | undefined, label: string }): ReactElement {
  return (
    <div
      data-slot="upload-progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      data-indeterminate={value === undefined || undefined}
    >
      <i style={value === undefined ? undefined : { width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

/** `PNG`, `PDF`: the extension, or the MIME subtype when the name has none. */
function fileTypeLabel(name: string, type?: string): string | undefined {
  const extension = EXTENSION.exec(name.split(URL_SUFFIX)[0]!)?.[1]
  if (extension)
    return extension.toUpperCase()
  const subtype = type?.split('/')[1]
  return subtype ? (MIME_SUFFIX.exec(subtype)?.[1] ?? subtype).toUpperCase() : undefined
}

function FileMetaLine({ name, size, type }: { name: string, size?: number | undefined, type?: string | undefined }): ReactElement | null {
  const parts = [size === undefined ? undefined : formatFileSize(size), fileTypeLabel(name, type)].filter(Boolean)
  if (!parts.length)
    return null
  return <span data-slot="upload-file-meta">{parts.map(part => <span key={part}>{part}</span>)}</span>
}

function RowAction({ label, tip, onClick, disabled, children }: { label: string, tip: string, onClick: () => void, disabled?: boolean, children: ReactNode }): ReactElement {
  return (
    <LumiTooltip content={tip}>
      <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={label} onClick={onClick}>{children}</Button>
    </LumiTooltip>
  )
}

function FileThumb({ name, type, src, failed }: { name: string, type?: string | undefined, src?: string | undefined, failed?: boolean }): ReactElement {
  const [broken, setBroken] = useState<string>()
  const kind = failed ? 'error' : fileKind(name, type)
  if (!failed && src && broken !== src)
    return <img data-slot="upload-preview" src={src} alt="" onError={() => setBroken(src)} />
  const Icon = failed ? AlertCircleIcon : kind === 'image' ? ImageIcon : FileIcon
  return <span data-slot="upload-file-icon" data-kind={kind} aria-hidden><Icon /></span>
}

/**
 * File field over a bound list of URLs. Only URLs enter `value`; the files in
 * flight, and the ones that failed, live here until they finish or are dismissed.
 * `onUploadFile` gives each file its own progress, cancel and retry; a host
 * that only has `onUpload` sends a batch and reports one `progress`.
 */
export function LumiUpload(props: UploadProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = [], onChange, onUpload, onUploadFile, onCancel, progress, error, accept, multiple, maxFiles, maxSize, hint, variant = 'dropzone', shape = 'square', disabled, readonly, invalid, loading, preview, ariaLabel, appearance = 'outline', size = 'md', className, id, name } = props
  const [files, setFiles] = useControllableValue(value, defaultValue, onChange)
  const [dragging, setDragging] = useState(false)
  const [viewing, setViewing] = useState<number>()
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(files)
  const dragDepth = useRef(0)
  const hintId = useId()
  latest.current = files

  const single = !multiple || variant === 'image'
  const commit = (urls: string[]): void => {
    if (!urls.length)
      return
    const next = single ? urls.slice(-1) : [...latest.current, ...urls]
    latest.current = next
    setFiles(next)
  }
  const queue = useUploadQueue({
    accept,
    maxSize,
    limit: maxFiles,
    single,
    room: inFlight => maxFiles === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxFiles - latest.current.length - inFlight),
    kept: files,
    onUpload,
    onUploadFile,
    onCancel,
    onUploaded: commit,
    // Without an upload service the field records the chosen names, as a plain file input would.
    onUnsent: (accepted) => {
      accepted.forEach(item => revoke(item.preview))
      commit(accepted.map(item => item.file.name))
    },
  })
  const { pending, batchBusy, meta, cancel, retry, dismiss } = queue

  const locked = disabled || readonly
  const unavailable = locked || loading || batchBusy
  const types = acceptLabel(accept, t)
  const sizeLabel = maxSize === undefined ? undefined : formatFileSize(maxSize)
  const generatedHint = types && sizeLabel
    ? t('lumi.upload.hintTypesSize', '{types} up to {size}', { types, size: sizeLabel })
    : sizeLabel
      ? t('lumi.upload.hintSize', 'Up to {size}', { size: sizeLabel })
      : types
  const countHint = !single && maxFiles !== undefined ? t('lumi.upload.hintFiles', 'Up to {count} files', { count: maxFiles }) : undefined
  const hintText = hint ?? ([generatedHint, countHint].filter(Boolean).join(' · ') || undefined)
  const describedBy = [hintText ? hintId : undefined, props['aria-describedby']].filter(Boolean).join(' ') || undefined

  const handleFiles = (list: FileList | File[] | null): void => {
    const selected = Array.from(list ?? [])
    if (input.current)
      input.current.value = ''
    if (!unavailable)
      queue.add(selected)
  }

  const open = (): void => {
    if (!unavailable)
      input.current?.click()
  }
  const removeAt = (index: number): void => {
    const next = latest.current.filter((_, itemIndex) => itemIndex !== index)
    latest.current = next
    setFiles(next)
  }

  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      event.preventDefault()
      if (unavailable)
        return
      dragDepth.current += 1
      setDragging(true)
    },
    onDragOver: (event: DragEvent) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = unavailable ? 'none' : 'copy'
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current)
        setDragging(false)
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      handleFiles(event.dataTransfer.files)
    },
  }

  const fileInput = (
    <input
      ref={input}
      id={id ? `${id}-input` : undefined}
      className="sr-only"
      type="file"
      tabIndex={-1}
      accept={accept}
      multiple={!single}
      disabled={unavailable}
      aria-hidden
      onChange={event => handleFiles(event.target.files)}
    />
  )
  const hidden = name && <input type="hidden" name={name} value={JSON.stringify(files)} disabled={disabled} />
  const hostError = error && (
    <p role="alert" data-slot="upload-error">
      <AlertCircleIcon aria-hidden />
      {error}
    </p>
  )

  const pendingRow = (item: PendingFile): ReactElement => {
    const itemName = item.file.name
    const percent = item.progress ?? progress
    // Once every byte is sent the server may still be working, so 100% reads as processing.
    const sent = percent !== undefined && percent >= 100
    const uploading = item.status === 'uploading'
    return (
      <li key={item.id} data-slot="upload-file" data-status={item.status}>
        <FileThumb name={itemName} type={item.file.type} src={item.preview} failed={!uploading} />
        <div data-slot="upload-file-body">
          <span data-slot="upload-file-name" title={itemName}>{itemName}</span>
          {uploading
            ? <FileMetaLine name={itemName} size={item.file.size} type={item.file.type} />
            : <span data-slot="upload-file-error" role="alert">{item.error}</span>}
          {uploading && <ProgressBar value={sent ? undefined : percent} label={t('lumi.upload.uploadingName', 'Uploading {name}', { name: itemName })} />}
        </div>
        <div data-slot="upload-file-status">
          {uploading
            ? sent || percent === undefined
              ? (
                  <span data-slot="upload-file-processing">
                    <Spinner aria-hidden />
                    {sent && t('lumi.upload.processing', 'Processing…')}
                  </span>
                )
              : <span data-slot="upload-file-percent">{`${percent}%`}</span>
            : !item.refused && (
                <Button type="button" variant="ghost" size="sm" disabled={unavailable} aria-label={t('lumi.upload.retryName', 'Retry {name}', { name: itemName })} onClick={() => retry(item)}>
                  <RefreshIcon data-icon="inline-start" />
                  {t('lumi.upload.retry', 'Retry')}
                </Button>
              )}
        </div>
        <div data-slot="upload-file-actions">
          {uploading
            ? (item.controller || onCancel) && (
                <RowAction label={t('lumi.upload.cancelName', 'Cancel upload of {name}', { name: itemName })} tip={t('lumi.upload.cancel', 'Cancel upload')} onClick={() => cancel(item)}><XIcon /></RowAction>
              )
            : <RowAction label={t('lumi.upload.dismissName', 'Dismiss {name}', { name: itemName })} tip={t('lumi.upload.dismiss', 'Dismiss')} onClick={() => dismiss([item.id])}><XIcon /></RowAction>}
        </div>
      </li>
    )
  }
  const thumbOf = (url: string): string | undefined =>
    meta.get(url)?.preview ?? (preview && (IMAGE_DATA_OR_BLOB.test(url) || IMAGE_FILE_EXTENSION.test(url)) ? url : undefined)
  const gallery = files.flatMap((url) => {
    const src = thumbOf(url)
    return src ? [{ source: url, url: src, alt: meta.get(url)?.name ?? fileName(url) }] : []
  })
  const doneRow = (url: string, index: number): ReactElement => {
    const known = meta.get(url)
    const itemName = known?.name ?? fileName(url)
    const thumb = thumbOf(url)
    const galleryIndex = gallery.findIndex(item => item.source === url)
    return (
      <li key={`${url}-${index}`} data-slot="upload-file" data-status="done">
        <FileThumb name={itemName} type={known?.type} src={thumb} />
        <div data-slot="upload-file-body">
          <span data-slot="upload-file-name" title={url}>{itemName}</span>
          <FileMetaLine name={itemName} size={known?.size} type={known?.type} />
        </div>
        <div data-slot="upload-file-status">
          <Badge variant="secondary" data-tone="success" data-appearance="soft">
            <CheckCircleIcon aria-hidden />
            {t('lumi.upload.done', 'Uploaded')}
          </Badge>
        </div>
        <div data-slot="upload-file-actions">
          {galleryIndex >= 0 && (
            <RowAction label={t('lumi.image.preview', 'Preview {name}', { name: itemName })} tip={t('lumi.image.preview', 'Preview {name}', { name: '' }).trim()} onClick={() => setViewing(galleryIndex)}><EyeIcon /></RowAction>
          )}
          {!locked && (
            <RowAction label={t('lumi.common.removeItem', 'Remove {name}', { name: itemName })} tip={t('lumi.common.remove', 'Remove')} disabled={unavailable} onClick={() => removeAt(index)}><TrashIcon /></RowAction>
          )}
        </div>
      </li>
    )
  }

  if (variant === 'image') {
    const active = pending.find(item => item.status === 'uploading')
    const failed = pending.find(item => item.status === 'error')
    const current = files[0]
    const src = active?.preview ?? (current ? meta.get(current)?.preview ?? current : undefined)
    const percent = active ? active.progress ?? progress : undefined
    return (
      <div className={cn('min-w-0', className)} data-slot="upload" data-variant="image" data-invalid={invalid || undefined} data-disabled={unavailable || undefined} data-testid={props['data-testid']}>
        {hidden}
        {fileInput}
        <div data-slot="upload-image-row">
          <div
            data-slot="upload-image"
            data-shape={shape}
            data-size={size}
            data-state={active ? 'uploading' : current ? 'filled' : 'empty'}
            data-dragging={dragging || undefined}
            {...(locked ? {} : dropHandlers)}
          >
            {src && <ImageTileMedia src={src} />}
            {!current && !active && (
              <button type="button" id={id} data-slot="upload-image-empty" disabled={unavailable} aria-label={ariaLabel ?? t('lumi.upload.uploadImage', 'Upload image')} aria-describedby={describedBy} aria-invalid={invalid} onClick={open}>
                <ImageIcon aria-hidden />
                <span>{t('lumi.upload.upload', 'Upload')}</span>
              </button>
            )}
            {current && !active && !locked && (
              <div data-slot="upload-image-overlay">
                <button type="button" id={id} disabled={unavailable} aria-label={t('lumi.upload.replaceName', 'Replace {name}', { name: ariaLabel ?? fileName(current) })} aria-describedby={describedBy} onClick={open}><UploadIcon aria-hidden /></button>
                <button type="button" disabled={unavailable} aria-label={t('lumi.common.removeItem', 'Remove {name}', { name: ariaLabel ?? fileName(current) })} onClick={() => removeAt(0)}><TrashIcon aria-hidden /></button>
              </div>
            )}
            {active && (
              <div data-slot="upload-image-progress">
                <Spinner aria-hidden />
                <ProgressBar value={percent !== undefined && percent >= 100 ? undefined : percent} label={t('lumi.upload.uploadingName', 'Uploading {name}', { name: active.file.name })} />
                {(active.controller || onCancel) && (
                  <button type="button" aria-label={t('lumi.upload.cancelName', 'Cancel upload of {name}', { name: active.file.name })} onClick={() => cancel(active)}><XIcon aria-hidden /></button>
                )}
              </div>
            )}
          </div>
          <div data-slot="upload-image-copy">
            {hintText && <span id={hintId} data-slot="upload-hint">{hintText}</span>}
            {failed && (
              <span data-slot="upload-file-error" role="alert">
                {failed.error}
                {!failed.refused && <button type="button" data-slot="upload-link" onClick={() => retry(failed)}>{t('lumi.upload.retry', 'Retry')}</button>}
                <button type="button" data-slot="upload-link" onClick={() => dismiss([failed.id])}>{t('lumi.upload.dismiss', 'Dismiss')}</button>
              </span>
            )}
            {hostError}
          </div>
        </div>
      </div>
    )
  }

  const rows = [...files.map(doneRow), ...pending.map(pendingRow)]
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)} data-slot="upload" data-variant={variant} data-invalid={invalid || undefined} data-disabled={unavailable || undefined} data-testid={props['data-testid']}>
      {hidden}
      {fileInput}
      {!readonly && (variant === 'button'
        ? (
            <div data-slot="upload-trigger">
              <Button id={id} type="button" variant="outline" size={size === 'sm' ? 'sm' : undefined} disabled={unavailable} aria-label={ariaLabel} aria-describedby={describedBy} aria-invalid={invalid} data-appearance={appearance} data-lumi-control-size={size} onClick={open}>
                {batchBusy || loading ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
                {single ? t('lumi.common.chooseFile', 'Choose file') : t('lumi.common.chooseFiles', 'Choose files')}
              </Button>
              {hintText && <span id={hintId} data-slot="upload-hint">{hintText}</span>}
            </div>
          )
        : (
            <button
              type="button"
              id={id}
              data-slot="upload-dropzone"
              data-dragging={dragging || undefined}
              data-size={size}
              data-appearance={appearance}
              disabled={unavailable}
              aria-label={ariaLabel}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onClick={open}
              {...dropHandlers}
            >
              <span data-slot="upload-dropzone-icon" aria-hidden>
                {batchBusy || loading ? <Spinner /> : <CloudUploadIcon />}
              </span>
              <span data-slot="upload-dropzone-title">
                <span data-slot="upload-dropzone-action">{t('lumi.upload.clickToUpload', 'Click to upload')}</span>
                {' '}
                {t('lumi.upload.orDrag', 'or drag and drop')}
              </span>
              {hintText && <span id={hintId} data-slot="upload-hint">{hintText}</span>}
            </button>
          ))}
      {hostError}
      {rows.length > 0 && <ul data-slot="upload-files" aria-label={t('lumi.upload.files', 'Files')} aria-live="polite">{rows}</ul>}
      {readonly && !rows.length && <p data-slot="upload-empty">{t('lumi.upload.empty', 'No files')}</p>}
      {gallery.length > 0 && <LumiLightbox items={gallery.map(({ url, alt }) => ({ url, alt }))} open={viewing !== undefined} index={viewing ?? 0} loop onOpenChange={open => !open && setViewing(undefined)} onIndexChange={setViewing} />}
    </div>
  )
}

function ImageTileMedia({ src }: { src: string }): ReactElement {
  const [broken, setBroken] = useState<string>()
  if (broken === src)
    return <span data-slot="upload-image-swatch" aria-hidden><ImageIcon /></span>
  return <img src={src} alt="" onError={() => setBroken(src)} />
}

const LONG_PRESS_MS = 350
const DRAG_START_PX = 4
const TOUCH_SLOP_PX = 8
const TILE_GLIDE: KeyframeAnimationOptions = { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
const TRACK_SEPARATOR = /\s+/

interface Point { x: number, y: number }

/** A tile on the move: dragged by a pointer, or picked up from the keyboard. */
interface Sorting {
  key: string
  from: number
  to: number
  mode: 'pointer' | 'keyboard'
}

interface TileDrag {
  /** Where the tile was taken, from its top-left corner. */
  grab: Point
  size: { width: number, height: number }
  /** Centres of the image slots, in the tiles box. */
  slots: Point[]
  /** Top-left of the lifted tile now, in the tiles box. */
  at: Point
}

/** A press on a tile: a mouse drags once it moves, a finger after a long press. */
interface Press {
  key: string
  index: number
  pointerId: number
  start: Point
  touch: boolean
  timer?: ReturnType<typeof setTimeout> | undefined
  drag?: TileDrag | undefined
}

function ProgressRing({ value, label }: { value?: number | undefined, label: string }): ReactElement {
  const circumference = 2 * Math.PI * 15
  const shown = value === undefined ? 0.3 : Math.max(2, Math.min(100, value)) / 100
  return (
    <span data-slot="image-grid-ring" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} data-indeterminate={value === undefined || undefined}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="15" />
        <circle cx="18" cy="18" r="15" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown)} />
      </svg>
      {value !== undefined && <span>{`${value}%`}</span>}
    </span>
  )
}

function TileAction({ action, label, tip, onClick, children }: { action: string, label: string, tip: string, onClick: () => void, children: ReactNode }): ReactElement {
  return (
    <LumiTooltip content={tip}>
      <button type="button" data-slot="image-grid-action" data-action={action} aria-label={label} onClick={onClick}>{children}</button>
    </LumiTooltip>
  )
}

interface ImageGridTileProps {
  src: string | undefined
  alt: string | undefined
  name: string
  cover: string | undefined
  order: number
  previewable: boolean
  sortable: boolean
  describedBy: string
  lifted: boolean
  drag: TileDrag | undefined
  tileRef: (node: HTMLElement | null) => void
  surfaceRef: (node: HTMLElement | null) => void
  onPreview: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onBlur: () => void
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
  onCover?: (() => void) | undefined
  onRemove?: (() => void) | undefined
}

function ImageGridTile(props: ImageGridTileProps): ReactElement {
  const { t } = useUiText()
  const { src, alt, name, cover, order, previewable, sortable, describedBy, lifted, drag, onCover, onRemove } = props
  const [broken, setBroken] = useState<string>()
  return (
    <figure
      ref={props.tileRef}
      data-slot="image-grid-tile"
      data-status="done"
      data-dragging={drag ? '' : undefined}
      data-lifted={lifted || undefined}
      style={drag ? { order, width: drag.size.width, height: drag.size.height, transform: `translate3d(${drag.at.x}px, ${drag.at.y}px, 0)` } : { order }}
    >
      {/* Enter previews and Space picks the tile up, so this is not a native button. */}
      <div
        ref={props.surfaceRef}
        role="button"
        tabIndex={previewable || sortable ? 0 : -1}
        data-slot="image-grid-preview"
        aria-label={t('lumi.image.preview', 'Preview {name}', { name })}
        aria-roledescription={sortable ? t('lumi.imageGrid.roleDescription', 'sortable image') : undefined}
        aria-describedby={sortable ? describedBy : undefined}
        aria-haspopup={previewable ? 'dialog' : undefined}
        aria-disabled={!previewable || undefined}
        onClick={props.onPreview}
        onKeyDown={props.onKeyDown}
        onPointerDown={props.onPointerDown}
        onBlur={props.onBlur}
        onContextMenu={props.onContextMenu}
      >
        {broken === src || !src
          ? <span data-slot="image-grid-swatch" role={alt ? 'img' : undefined} aria-label={alt || undefined}><ImageIcon aria-hidden /></span>
          : <img src={src} alt={alt ?? ''} draggable={false} onError={() => setBroken(src)} />}
      </div>
      {cover && <figcaption>{cover}</figcaption>}
      {(onCover || onRemove) && (
        <div data-slot="image-grid-actions">
          {onCover && (
            <TileAction action="cover" label={t('lumi.imageGrid.setCoverName', 'Set {name} as cover', { name })} tip={t('lumi.imageGrid.setCover', 'Set as cover')} onClick={onCover}>
              <StarIcon aria-hidden />
            </TileAction>
          )}
          {onRemove && (
            <TileAction action="remove" label={t('lumi.common.removeItem', 'Remove {name}', { name })} tip={t('lumi.common.remove', 'Remove')} onClick={onRemove}>
              <TrashIcon aria-hidden />
            </TileAction>
          )}
        </div>
      )}
    </figure>
  )
}

/**
 * An image uploader laid out as square tiles over a bound `{ url }[]` list;
 * the first tile is the cover. Files come from the upload tile or a drop and
 * go through the same queue as `LumiUpload`, so each shows its own progress,
 * cancel and retry. Tiles reorder by pointer drag (a long press on touch) or
 * from the keyboard, the way Kanban cards do.
 */
export function LumiImageGrid(props: ImageGridProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = [], onChange, onUpload, onUploadFile, onFiles, onCancel, progress, loading, accept = 'image/*', multiple = true, max, maxSize, hint, coverLabel = t('lumi.imageGrid.cover', 'Cover'), addLabel = t('lumi.imageGrid.add', 'Upload image'), name, id, error, disabled, readonly, invalid, ariaLabel, className } = props
  const [images, setImages] = useControllableValue<ImageGridItem[]>(value, defaultValue, onChange)
  const [preview, setPreview] = useState<number>()
  const [sorting, setSorting] = useState<Sorting>()
  const [announcement, setAnnouncement] = useState('')
  const [dropping, setDropping] = useState(false)
  const latest = useRef(images)
  const sortingRef = useRef(sorting)
  const input = useRef<HTMLInputElement>(null)
  const tilesRef = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const surfaces = useRef(new Map<string, HTMLElement>())
  const refs = useRef(new Map<string, (node: HTMLElement | null) => void>())
  const positions = useRef(new Map<string, Point>())
  const press = useRef<Press>(undefined)
  const stopListening = useRef<() => void>(undefined)
  const swallowClick = useRef(false)
  const focusAfter = useRef<{ key: string, index: number }>(undefined)
  const dropDepth = useRef(0)
  const hintId = useId()
  const instructionsId = useId()
  latest.current = images
  sortingRef.current = sorting

  const write = (next: ImageGridItem[]): void => {
    latest.current = next
    setImages(next)
  }
  const queue = useUploadQueue({
    accept,
    maxSize,
    limit: max,
    room: inFlight => max === undefined ? Number.POSITIVE_INFINITY : Math.max(0, max - latest.current.length - inFlight),
    kept: images.map(image => image.url),
    onUpload,
    onUploadFile,
    onCancel,
    onUploaded: urls => write([...latest.current, ...urls.map(url => ({ url }))]),
    onUnsent: (accepted) => {
      if (onFiles) {
        accepted.forEach(item => revoke(item.preview))
        onFiles(accepted.map(item => item.file))
        return
      }
      // Without an upload handler the chosen images stay local previews, so a static page still shows them.
      for (const item of accepted)
        queue.meta.set(item.preview ?? item.file.name, { name: item.file.name, size: item.file.size, type: item.file.type, preview: item.preview })
      write([...latest.current, ...accepted.map(item => ({ url: item.preview ?? item.file.name }))])
    },
  })
  const { pending, meta } = queue

  const count = images.length
  const inFlight = pending.filter(item => item.status === 'uploading').length
  const locked = Boolean(disabled || readonly)
  const unavailable = locked || Boolean(loading) || queue.batchBusy
  const sortable = !locked && count > 1
  const canAdd = !readonly && (max === undefined || count + inFlight < max)
  const keys = images.map((item, index) => `${item.url}#${images.slice(0, index).filter(other => other.url === item.url).length}`)
  const indices = keys.map((_, index) => index)
  const order = sorting ? moveRow(indices, sorting.from, sorting.to) : indices
  const drag = sorting?.mode === 'pointer' ? press.current?.drag : undefined

  const nameOf = (index: number): string => {
    const item = images[index]
    return item?.alt || (item && meta.get(item.url)?.name) || t('lumi.imageGrid.image', 'image {index}', { index: index + 1 })
  }
  const positionText = (index: number): string => t('lumi.imageGrid.position', 'Position {position} of {total}.', { position: index + 1, total: count })
  const refFor = (map: Map<string, HTMLElement>, kind: string, key: string): ((node: HTMLElement | null) => void) => {
    const id = `${kind}:${key}`
    let ref = refs.current.get(id)
    if (!ref) {
      ref = (node) => {
        if (node)
          map.set(key, node)
        else map.delete(key)
      }
      refs.current.set(id, ref)
    }
    return ref
  }
  const sortTo = (next: Sorting | undefined): void => {
    sortingRef.current = next
    setSorting(next)
  }
  const move = (from: number, to: number): void => {
    if (from !== to)
      write(moveRow(latest.current, from, to))
  }
  /** Ends a move: a drop keeps the new place, anything else puts the tile back. */
  const finishSort = (drop: boolean): void => {
    const active = sortingRef.current
    if (!active)
      return
    sortTo(undefined)
    const itemName = nameOf(active.from)
    if (active.mode === 'keyboard')
      focusAfter.current = { key: active.key, index: drop ? active.to : active.from }
    if (drop && active.to !== active.from) {
      move(active.from, active.to)
      setAnnouncement(t('lumi.imageGrid.moved', 'Moved {name} to position {position} of {total}.', { name: itemName, position: active.to + 1, total: count }))
      return
    }
    const stays = t('lumi.imageGrid.stays', '{name} stays at position {position} of {total}.', { name: itemName, position: active.from + 1, total: count })
    setAnnouncement(drop ? stays : `${t('lumi.imageGrid.cancelled', 'Move cancelled.')} ${stays}`)
  }
  const openPreview = (index: number): void => {
    if (!disabled)
      setPreview(index)
  }
  const remove = (index: number): void => {
    const neighbour = keys[index + 1] ?? keys[index - 1]
    if (neighbour)
      focusAfter.current = { key: neighbour, index: keys[index + 1] ? index : index - 1 }
    write(latest.current.filter((_, itemIndex) => itemIndex !== index))
  }
  const makeCover = (index: number): void => {
    focusAfter.current = { key: keys[index]!, index: 0 }
    move(index, 0)
    setAnnouncement(t('lumi.imageGrid.madeCover', '{name} is now the cover.', { name: nameOf(index) }))
  }

  const columns = (): number => {
    const template = tilesRef.current ? getComputedStyle(tilesRef.current).gridTemplateColumns : ''
    return template && template !== 'none' ? template.trim().split(TRACK_SEPARATOR).length : 1
  }
  const onTileKeyDown = (event: KeyboardEvent<HTMLElement>, index: number): void => {
    const active = sortingRef.current
    if (active?.mode !== 'keyboard' || active.from !== index) {
      if (event.key === 'Enter' || (event.key === ' ' && !sortable)) {
        event.preventDefault()
        openPreview(index)
      }
      else if (event.key === ' ' && !active) {
        event.preventDefault()
        sortTo({ key: keys[index]!, from: index, to: index, mode: 'keyboard' })
        setAnnouncement(`${t('lumi.imageGrid.picked', 'Picked up {name}.', { name: nameOf(index) })} ${positionText(index)}`)
      }
      return
    }
    const across = tilesRef.current && getComputedStyle(tilesRef.current).direction === 'rtl' ? -1 : 1
    const steps: Record<string, number> = { ArrowLeft: -across, ArrowRight: across, ArrowUp: -columns(), ArrowDown: columns() }
    if (Object.hasOwn(steps, event.key) || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const to = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : active.to + steps[event.key]!
      if (to < 0 || to >= count || to === active.to)
        return
      sortTo({ ...active, to })
      setAnnouncement(positionText(to))
    }
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      finishSort(true)
    }
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finishSort(false)
    }
  }
  const onTileBlur = (): void => {
    if (sortingRef.current?.mode !== 'keyboard')
      return
    // A reorder can move the focused node for a moment; only a real departure cancels.
    setTimeout(() => {
      const active = sortingRef.current
      if (active?.mode === 'keyboard' && document.activeElement !== surfaces.current.get(active.key))
        finishSort(false)
    }, 0)
  }

  const release = (): void => {
    if (press.current?.timer)
      clearTimeout(press.current.timer)
    press.current = undefined
    stopListening.current?.()
    stopListening.current = undefined
  }
  // Window listeners outlive a render, so they call through to the latest handlers.
  const track = useRef({ begin: (_press: Press): void => {}, move: (_event: PointerEvent): void => {}, end: (_cancelled: boolean): void => {} })
  track.current = {
    begin: (current) => {
      const box = tilesRef.current
      const node = nodes.current.get(current.key)
      if (!box || !node || press.current !== current)
        return
      const rect = box.getBoundingClientRect()
      const origin = { x: node.offsetLeft, y: node.offsetTop }
      current.drag = {
        grab: { x: current.start.x - rect.left - origin.x, y: current.start.y - rect.top - origin.y },
        size: { width: node.offsetWidth, height: node.offsetHeight },
        slots: keys.map((key) => {
          const slot = nodes.current.get(key)
          return slot ? { x: slot.offsetLeft + slot.offsetWidth / 2, y: slot.offsetTop + slot.offsetHeight / 2 } : origin
        }),
        at: origin,
      }
      sortTo({ key: current.key, from: current.index, to: current.index, mode: 'pointer' })
      setAnnouncement(`${t('lumi.imageGrid.picked', 'Picked up {name}.', { name: nameOf(current.index) })} ${positionText(current.index)}`)
    },
    move: (event) => {
      const current = press.current
      if (!current || event.pointerId !== current.pointerId)
        return
      if (!current.drag) {
        const distance = Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y)
        // A finger that moves before the long press ends is scrolling the page.
        if (current.touch) {
          if (distance > TOUCH_SLOP_PX)
            release()
          return
        }
        if (distance < DRAG_START_PX)
          return
        track.current.begin(current)
      }
      const box = tilesRef.current
      const lifted = current.drag
      if (!box || !lifted)
        return
      const rect = box.getBoundingClientRect()
      lifted.at = { x: event.clientX - rect.left - lifted.grab.x, y: event.clientY - rect.top - lifted.grab.y }
      const node = nodes.current.get(current.key)
      if (node)
        node.style.transform = `translate3d(${lifted.at.x}px, ${lifted.at.y}px, 0)`
      const centre = { x: lifted.at.x + lifted.size.width / 2, y: lifted.at.y + lifted.size.height / 2 }
      const distances = lifted.slots.map(slot => Math.hypot(slot.x - centre.x, slot.y - centre.y))
      const to = distances.indexOf(Math.min(...distances))
      const active = sortingRef.current
      if (active && to >= 0 && active.to !== to)
        sortTo({ ...active, to })
    },
    end: (cancelled) => {
      const current = press.current
      release()
      if (!current?.drag)
        return
      // The tile glides from where it was let go into its slot.
      positions.current.set(current.key, current.drag.at)
      swallowClick.current = true
      setTimeout(() => {
        swallowClick.current = false
      }, 0)
      finishSort(!cancelled)
    },
  }
  const onTilePointerDown = (event: ReactPointerEvent<HTMLElement>, index: number): void => {
    if (!sortable || sortingRef.current || press.current || !event.isPrimary || event.button !== 0)
      return
    const current: Press = { key: keys[index]!, index, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, touch: event.pointerType === 'touch' }
    press.current = current
    if (current.touch)
      current.timer = setTimeout(() => track.current.begin(current), LONG_PRESS_MS)
    const onMove = (next: PointerEvent): void => track.current.move(next)
    const onUp = (next: PointerEvent): void => {
      if (next.pointerId === current.pointerId)
        track.current.end(false)
    }
    const onCancel = (next: PointerEvent): void => {
      if (next.pointerId === current.pointerId)
        track.current.end(true)
    }
    const onEscape = (next: globalThis.KeyboardEvent): void => {
      if (next.key !== 'Escape' || !current.drag)
        return
      next.preventDefault()
      next.stopPropagation()
      track.current.end(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onEscape, true)
    stopListening.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onEscape, true)
    }
  }

  useEffect(() => {
    const box = tilesRef.current
    // Registered up front and not passive: Safari only lets a touchmove listener
    // that existed before the touch began keep a dragging finger from scrolling.
    const hold = (event: TouchEvent): void => {
      if (press.current?.drag)
        event.preventDefault()
    }
    box?.addEventListener('touchmove', hold, { passive: false })
    return () => {
      box?.removeEventListener('touchmove', hold)
      stopListening.current?.()
    }
  }, [])

  // Tiles that change place glide from where they were (FLIP); the lifted one follows the pointer instead.
  const layout = [order.map(index => keys[index]).join('|'), sorting?.mode, pending.map(item => item.id).join('|'), canAdd].join('/')
  useLayoutEffect(() => {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const lifted = sortingRef.current?.mode === 'pointer' ? sortingRef.current.key : undefined
    const next = new Map<string, Point>()
    for (const [key, node] of nodes.current) {
      const now = { x: node.offsetLeft, y: node.offsetTop }
      next.set(key, now)
      const before = positions.current.get(key)
      if (key === lifted || still || !before || typeof node.animate !== 'function')
        continue
      const dx = before.x - now.x
      const dy = before.y - now.y
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1)
        node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], TILE_GLIDE)
    }
    positions.current = next
  }, [layout])
  // Committing an order moves DOM nodes, which drops focus; give it back to the tile that moved.
  useLayoutEffect(() => {
    const target = focusAfter.current
    if (!target)
      return
    const node = surfaces.current.get(target.key)
    if (node && document.activeElement !== node)
      node.focus()
    if (!node || keys[target.index] === target.key)
      focusAfter.current = undefined
  })

  const handleFiles = (list: FileList | File[] | null): void => {
    const selected = Array.from(list ?? [])
    if (input.current)
      input.current.value = ''
    if (!unavailable && selected.length)
      queue.add(multiple ? selected : selected.slice(0, 1))
  }
  const open = (): void => {
    if (!unavailable)
      input.current?.click()
  }
  const carriesFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files')
  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event))
        return
      event.preventDefault()
      dropDepth.current += 1
      if (!unavailable)
        setDropping(true)
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event))
        return
      event.preventDefault()
      event.dataTransfer.dropEffect = unavailable ? 'none' : 'copy'
    },
    onDragLeave: (event: DragEvent) => {
      if (!carriesFiles(event))
        return
      dropDepth.current = Math.max(0, dropDepth.current - 1)
      if (!dropDepth.current)
        setDropping(false)
    },
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event))
        return
      event.preventDefault()
      dropDepth.current = 0
      setDropping(false)
      handleFiles(event.dataTransfer.files)
    },
  }

  const types = acceptLabel(accept, t)
  const sizeLabel = maxSize === undefined ? undefined : formatFileSize(maxSize)
  const generatedHint = sizeLabel
    ? types ? t('lumi.upload.hintTypesSize', '{types} up to {size}', { types, size: sizeLabel }) : t('lumi.upload.hintSize', 'Up to {size}', { size: sizeLabel })
    : accept === 'image/*' ? undefined : types
  const hintText = hint ?? generatedHint
  const gallery = images.map(item => ({ url: meta.get(item.url)?.preview ?? item.url, alt: item.alt }))

  const pendingTile = (item: PendingFile, position: number): ReactElement => {
    const fileLabel = item.file.name
    const uploading = item.status === 'uploading'
    const percent = item.progress ?? progress
    // Once every byte is sent the server may still be working, so 100% reads as processing.
    const sent = percent !== undefined && percent >= 100
    return (
      <div key={item.id} ref={refFor(nodes.current, 'node', item.id)} data-slot="image-grid-tile" data-status={item.status} title={fileLabel} style={{ order: position }}>
        {uploading && item.preview && <img src={item.preview} alt="" draggable={false} />}
        {uploading
          ? (
              <div data-slot="image-grid-progress">
                <ProgressRing value={sent ? undefined : percent} label={t('lumi.upload.uploadingName', 'Uploading {name}', { name: fileLabel })} />
                {sent && <span data-slot="image-grid-progress-label">{t('lumi.upload.processing', 'Processing…')}</span>}
              </div>
            )
          : (
              <div data-slot="image-grid-failed">
                <AlertCircleIcon aria-hidden />
                <span role="alert" data-slot="image-grid-failed-text" title={item.error}>{item.error}</span>
                {!item.refused && (
                  <button type="button" data-slot="image-grid-retry" disabled={unavailable} aria-label={t('lumi.upload.retryName', 'Retry {name}', { name: fileLabel })} onClick={() => queue.retry(item)}>
                    <RefreshIcon aria-hidden />
                    {t('lumi.upload.retry', 'Retry')}
                  </button>
                )}
              </div>
            )}
        {(!uploading || item.controller || onCancel) && (
          <div data-slot="image-grid-actions">
            {uploading
              ? (
                  <TileAction action="cancel" label={t('lumi.upload.cancelName', 'Cancel upload of {name}', { name: fileLabel })} tip={t('lumi.upload.cancel', 'Cancel upload')} onClick={() => queue.cancel(item)}>
                    <XIcon aria-hidden />
                  </TileAction>
                )
              : (
                  <TileAction action="dismiss" label={t('lumi.upload.dismissName', 'Dismiss {name}', { name: fileLabel })} tip={t('lumi.upload.dismiss', 'Dismiss')} onClick={() => queue.dismiss([item.id])}>
                    <XIcon aria-hidden />
                  </TileAction>
                )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      id={id}
      className={cn('min-w-0', className)}
      role="group"
      aria-label={ariaLabel ?? props['aria-label']}
      aria-describedby={props['aria-describedby']}
      data-slot="image-grid"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-sorting={sorting?.mode}
      data-dropping={dropping || undefined}
      data-testid={props['data-testid']}
      {...(locked ? {} : dropHandlers)}
    >
      {name && <input type="hidden" name={name} value={JSON.stringify(images)} disabled={disabled} />}
      {!readonly && <input ref={input} className="sr-only" type="file" tabIndex={-1} accept={accept} multiple={multiple} disabled={unavailable} aria-hidden onChange={event => handleFiles(event.target.files)} />}
      {sortable && <p id={instructionsId} className="sr-only">{t('lumi.imageGrid.instructions', 'Press Enter to preview. Press Space to pick up an image, the arrow keys to move it, then Space to drop or Escape to cancel.')}</p>}
      <div ref={tilesRef} data-slot="image-grid-tiles">
        {images.map((item, index) => {
          const key = keys[index]!
          const position = order.indexOf(index)
          return (
            <ImageGridTile
              // Tiles hold their load state, so a move or a removal must not remount the rest.
              key={key}
              src={meta.get(item.url)?.preview ?? item.thumbnail ?? item.url}
              alt={item.alt}
              name={nameOf(index)}
              cover={position === 0 ? coverLabel : undefined}
              order={position}
              previewable={!disabled}
              sortable={sortable}
              describedBy={instructionsId}
              lifted={sorting?.mode === 'keyboard' && sorting.from === index}
              drag={sorting?.mode === 'pointer' && sorting.from === index ? drag : undefined}
              tileRef={refFor(nodes.current, 'node', key)}
              surfaceRef={refFor(surfaces.current, 'surface', key)}
              onPreview={() => !swallowClick.current && openPreview(index)}
              onKeyDown={event => onTileKeyDown(event, index)}
              onPointerDown={event => onTilePointerDown(event, index)}
              onBlur={onTileBlur}
              onContextMenu={(event) => {
                if (press.current)
                  event.preventDefault()
              }}
              onCover={!locked && index > 0 ? () => makeCover(index) : undefined}
              onRemove={locked ? undefined : () => remove(index)}
            />
          )
        })}
        {drag && sorting && <div ref={refFor(nodes.current, 'node', 'placeholder')} data-slot="image-grid-placeholder" aria-hidden style={{ order: sorting.to }} />}
        {pending.map((item, index) => pendingTile(item, count + index))}
        {canAdd && (
          <button
            ref={refFor(nodes.current, 'node', 'add')}
            type="button"
            data-slot="image-grid-add"
            disabled={unavailable}
            aria-describedby={hintText ? hintId : undefined}
            aria-invalid={invalid || undefined}
            style={{ order: count + pending.length }}
            onClick={open}
          >
            <span data-slot="image-grid-add-icon" aria-hidden>{loading || queue.batchBusy ? <Spinner /> : <UploadIcon />}</span>
            {addLabel}
          </button>
        )}
      </div>
      {(hintText || max !== undefined) && (
        <div data-slot="image-grid-meta">
          <span id={hintId} data-slot="upload-hint">{hintText}</span>
          {max !== undefined && (
            <span data-slot="image-grid-count">
              <span aria-hidden>{`${count}/${max}`}</span>
              <span className="sr-only">{t('lumi.imageGrid.count', '{count} of {max} images', { count, max })}</span>
            </span>
          )}
        </div>
      )}
      {error && <p role="alert" data-slot="image-grid-error">{error}</p>}
      {!locked && <p role="status" aria-live="assertive" className="sr-only" data-slot="image-grid-announcer">{announcement}</p>}
      <LumiLightbox items={gallery} open={preview !== undefined} index={preview ?? 0} loop onOpenChange={open => !open && setPreview(undefined)} onIndexChange={setPreview} />
    </div>
  )
}
