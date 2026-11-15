import type { ImportProgress, ImportResult, RunExportOptions, RunImportOptions, TransferDownload, TransferFile, TransferHost } from '../core/index.js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { DEFAULT_IMPORT_ACCEPT, runExport, runImport, sessionVersion, uploadImport } from '../core/index.js'
import { browserTransferHost } from './browser-files.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'

export interface UseExportOptions extends Omit<RunExportOptions, 'onProgress' | 'signal'> {
  /** Where the file goes; the browser download by default. */
  save?: TransferHost['save']
}

export interface UseExportReturn {
  /** Loads the records and saves the file; the newest call wins over an earlier one still loading. */
  trigger: () => Promise<TransferFile | TransferDownload | undefined>
  /** True while the export runs. */
  isLoading: boolean
  /** Records loaded so far and their total; with `url`, bytes received and the file's size when the backend sends `Content-Length`. */
  progress?: { loaded: number, total?: number }
  /** Why the last export failed. */
  error?: Error
}

/** Exports a resource's matching records as CSV or JSON, or saves the file the backend builds at `url`, the same way as the `exportList` action. */
export function useExport(input: UseExportOptions): UseExportReturn {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const client = useQueryClient()
  const latest = useRef(options)
  latest.current = options
  const running = useRef<AbortController | undefined>(undefined)
  const [state, setState] = useState<Omit<UseExportReturn, 'trigger'>>({ isLoading: false })
  const trigger = useCallback(async () => {
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    const { save, ...params } = latest.current
    setState({ isLoading: true, progress: { loaded: 0 } })
    try {
      const file = await runExport(lumi, client, { ...params, signal: controller.signal, onProgress: progress => setState({ isLoading: true, progress }) }, save ?? browserTransferHost.save)
      setState(current => ({ ...current, isLoading: false }))
      return file
    }
    catch (error) {
      if (controller.signal.aborted)
        return undefined
      setState(current => ({ ...current, isLoading: false, error: error as Error }))
      throw error
    }
  }, [lumi, client])
  return { trigger, ...state }
}

export interface UseImportOptions extends Omit<RunImportOptions, 'onProgress' | 'signal'> {
  /** File types the picker offers, e.g. `.csv,.json`. */
  accept?: string
  /** Chooses and reads the file of a browser import; the browser's picker by default. */
  pick?: TransferHost['pick']
  /** Chooses the file of a backend import (`url`); the browser's picker by default. */
  pickFile?: TransferHost['pickFile']
  /** Called with the result once the import ended. */
  onFinish?: (result: ImportResult) => void
}

export interface UseImportReturn {
  /** Opens the file picker, or imports the given file; resolves undefined when the reader cancels. */
  trigger: (file?: Pick<TransferFile, 'name' | 'content'> | File) => Promise<ImportResult | undefined>
  /** Stops after the batch under way. */
  cancel: () => void
  /** True while the import runs. */
  isLoading: boolean
  /** Records processed, accepted and refused so far; with `url`, the percent of the file uploaded. */
  progress?: ImportProgress
  /** How the last import went: totals and the refused rows. */
  result?: ImportResult
  /** Why the last import failed as a whole. */
  error?: Error
}

/** Creates the records of a CSV or JSON file with progress, or uploads the file for the backend to import at `url`, the same way as the `importList` action. */
export function useImport(input: UseImportOptions): UseImportReturn {
  const options = useScopedTarget(input)
  const lumi = useLumi()
  const client = useQueryClient()
  const latest = useRef(options)
  latest.current = options
  const running = useRef<AbortController | undefined>(undefined)
  const [state, setState] = useState<Omit<UseImportReturn, 'trigger' | 'cancel'>>({ isLoading: false })
  const trigger = useCallback<UseImportReturn['trigger']>(async (given) => {
    const version = sessionVersion(lumi)
    const { accept, pick, pickFile, onFinish, ...params } = latest.current
    const url = params.url
    // The backend reads the file itself, so it is uploaded unread.
    const chosen = given ?? (url
      ? await (pickFile ?? browserTransferHost.pickFile!)(accept)
      : await (pick ?? browserTransferHost.pick)(accept ?? DEFAULT_IMPORT_ACCEPT))
    if (!chosen)
      return undefined
    if (version !== sessionVersion(lumi))
      throw new Error('[lumi] The session changed while choosing a file.')
    const upload = url ? (chosen instanceof Blob ? chosen : new File([chosen.content], chosen.name)) : undefined
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    setState({ isLoading: true })
    try {
      const file = upload ? undefined : chosen instanceof Blob ? { name: chosen.name, content: await chosen.text() } : chosen
      if (version !== sessionVersion(lumi))
        throw new Error('[lumi] The session changed while reading the file.')
      const shared = { ...params, signal: controller.signal, onProgress: (progress: ImportProgress) => {
        if (version === sessionVersion(lumi) && running.current === controller)
          setState(current => ({ ...current, progress }))
      } }
      const result = upload
        ? await uploadImport(lumi, client, upload, { ...shared, url: url! })
        : await runImport(lumi, client, file!, shared)
      if (running.current !== controller)
        return undefined
      if (version !== sessionVersion(lumi)) {
        setState({ isLoading: false })
        return undefined
      }
      setState(current => ({ ...current, isLoading: false, result }))
      onFinish?.(result)
      return result
    }
    catch (error) {
      if (running.current !== controller)
        return undefined
      if (version !== sessionVersion(lumi)) {
        setState({ isLoading: false })
        return undefined
      }
      setState(current => ({ ...current, isLoading: false, error: error as Error }))
      if (controller.signal.aborted)
        return undefined
      throw error
    }
  }, [lumi, client])
  const cancel = useCallback(() => running.current?.abort(), [])
  return { trigger, cancel, ...state }
}
