import type { ValidationCheck } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ComponentType } from 'react'
import type { LumiContext } from '../core/context.js'
import type { UploadOptions, UploadResult } from '../core/upload.js'
import { useBoundProp, useFieldValidation } from '@json-render/react'
import { QueryClientContext } from '@tanstack/react-query'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { uploadRequestSchema } from '../catalog/index.js'
import { toastError } from '../core/feedback.js'
import { uploadFiles } from '../core/upload-transport.js'
import { mergeUploadOptions } from '../core/upload.js'
import { LumiContextReact } from './context.js'
import { useDataProviderName } from './data-scope.js'

export interface UseUploadOptions extends UploadOptions {
  /** The Lumi context to use outside a Lumi provider. */
  context?: LumiContext
}
export interface UseUploadReturn {
  /** Percent of the files `upload` is sending, 0 to 100. */
  progress: number
  /** True while `upload` runs; another call is refused until it ends. */
  uploading: boolean
  /** Why the last `upload` failed. */
  error: Error | null
  /** Sends the files one after another and answers their results in order. */
  upload: (
    input: File | File[] | FileList,
    options?: UploadOptions,
  ) => Promise<UploadResult[]>
  /**
   * Sends one file on its own: several may run at once, each with its own
   * progress and `signal`. It leaves the shared progress/uploading/error alone.
   */
  uploadFile: (
    file: File,
    options?: UploadOptions & { onProgress?: (percent: number) => void },
  ) => Promise<UploadResult>
  /** Aborts the upload under way. */
  cancel: () => void
  /** Clears the progress and the error. */
  reset: () => void
}
/** Uploads files with progress and cancellation, through the data provider's client or straight to object storage with `sign`; defaults come from the context's `upload` option. */
export function useUpload(input: UseUploadOptions = {}): UseUploadReturn {
  // Relative upload URLs resolve against the scope's provider, as reads do.
  const scoped = useDataProviderName(input.dataProviderName)
  const defaults = scoped ? { ...input, dataProviderName: scoped } : input
  const queryClient = useContext(QueryClientContext)
  const injected = useContext(LumiContextReact)
  const context = defaults.context ?? injected ?? undefined
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [status, setStatus] = useState({
    progress: 0,
    uploading: false,
    error: null as Error | null,
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])
  const upload: UseUploadReturn['upload'] = async (input, overrides = {}) => {
    if (active.current)
      throw new Error('[lumi] Upload is already in progress.')
    const controller = new AbortController()
    active.current = controller
    const current = (): boolean =>
      mounted.current && active.current === controller
    const options = mergeUploadOptions(
      context?.config.upload ?? {},
      defaults,
      overrides,
    )
    const external = options.signal
    const abort = (): void => controller.abort()
    external?.addEventListener('abort', abort, { once: true })
    if (external?.aborted)
      controller.abort()
    setStatus({ progress: 0, uploading: true, error: null })
    try {
      const results = await uploadFiles(
        context,
        input,
        { ...options, signal: controller.signal },
        (progress) => {
          if (current())
            setStatus(current => ({ ...current, progress }))
        },
        queryClient,
      )
      if (!current()) {
        throw Object.assign(new Error('Upload aborted'), {
          name: 'AbortError',
        })
      }
      return results
    }
    catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      if (current() && error.name !== 'AbortError')
        setStatus(current => ({ ...current, error }))
      throw error
    }
    finally {
      external?.removeEventListener('abort', abort)
      if (current())
        setStatus(current => ({ ...current, uploading: false }))
      if (active.current === controller)
        active.current = null
    }
  }
  const uploadFile: UseUploadReturn['uploadFile'] = async (file, { onProgress, ...overrides } = {}) => {
    const options = mergeUploadOptions(
      context?.config.upload ?? {},
      defaults,
      overrides,
    )
    const [result] = await uploadFiles(context, file, options, onProgress, queryClient)
    if (!result)
      throw new Error('[lumi] Upload returned no file.')
    return result
  }
  return {
    ...status,
    upload,
    uploadFile,
    cancel: () => active.current?.abort(),
    reset: () => {
      active.current?.abort()
      active.current = null
      setStatus({ progress: 0, uploading: false, error: null })
    },
  }
}

/**
 * Compose a native registry entry with any controlled upload UI: a file list
 * of URLs (Upload) or image items (ImageGrid). The component owns the shape of
 * `value`; the service only turns each file into a URL.
 */
export function connectUpload(Component: ComponentType<any>) {
  return function ConnectedUpload({
    props,
    bindings,
    emit,
  }: BaseComponentProps) {
    const { upload: request, checks, ...ui } = props
    const service = useUpload(uploadRequestSchema.parse(request ?? {}))
    const context = useContext(LumiContextReact)
    const [value, setValue] = useBoundProp(props.value, bindings?.value)
    const config = useMemo(
      () => (checks ? { checks: checks as ValidationCheck[] } : undefined),
      [checks],
    )
    const validation = useFieldValidation(bindings?.value ?? '', config)
    const reported = async <T,>(run: () => Promise<T>): Promise<T> => {
      try {
        return await run()
      }
      catch (error) {
        if (context)
          toastError(context, error)
        throw error
      }
    }
    return (
      <Component
        {...ui}
        value={value}
        loading={service.uploading}
        progress={service.progress}
        invalid={ui.invalid || !validation.isValid}
        error={service.error?.message ?? ui.error ?? validation.errors[0]}
        onCancel={service.cancel}
        onUpload={async (files: File[]) =>
          (await reported(() => service.upload(files))).map(file => file.url)}
        onUploadFile={async (
          file: File,
          { signal, onProgress }: { signal: AbortSignal, onProgress: (percent: number) => void },
        ) => (await reported(() => service.uploadFile(file, { signal, onProgress }))).url}
        onChange={(next: unknown) => {
          setValue(next)
          emit('change')
        }}
      />
    )
  }
}
