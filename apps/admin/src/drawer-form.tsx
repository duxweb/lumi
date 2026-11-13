import type { UseFormReturn } from '@duxweb/lumi'
import { useAdminDrawer, useAdminDrawerChrome, useUnsavedChangesGuard } from '@duxweb/lumi-admin'
import { LumiButton as Button } from '@duxweb/lumi-ui'
import { useEffect, useState } from 'react'

/**
 * Footer and close guard shared by the create/edit drawers: Save submits through
 * the form, which awaits validation and the request, and closes only on success.
 */
export function useDrawerSave<T extends Record<string, any>>(form: UseFormReturn<T>, options: { owner: string, title: string, description?: string | undefined, ready: boolean }): () => void {
  const drawer = useAdminDrawer()
  // The form settles its baseline on the render after submit resolves; closing
  // waits for that render, or the close guard would still see a dirty draft.
  const [saved, setSaved] = useState(false)
  useUnsavedChangesGuard({ dirty: form.isDirty && !saved, owner: options.owner })
  useEffect(() => {
    if (saved && !form.isDirty)
      drawer.close()
  }, [drawer, form.isDirty, saved])
  const save = (): void => {
    void form.submit().then(() => setSaved(true), () => undefined)
  }
  useAdminDrawerChrome({
    revision: `${options.title}:${options.description ?? ''}:${form.isDirty}:${form.isSubmitting}:${options.ready}`,
    title: options.title,
    description: options.description,
    footerStart: form.isDirty ? <span className="lumi-form-page__dirty">Unsaved</span> : undefined,
    footerEnd: (
      <>
        <Button label="Cancel" appearance="outline" disabled={form.isSubmitting} onClick={drawer.close} />
        <Button label="Save" loading={form.isSubmitting} disabled={!options.ready || !form.isDirty || form.isSubmitting} onClick={save} />
      </>
    ),
  })
  return save
}
