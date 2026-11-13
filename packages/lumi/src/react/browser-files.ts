import type { TransferHost } from '../core/index.js'

/** Lets the reader choose one file through a hidden file input; undefined when they close the picker. */
function pickFile(accept?: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept)
      input.accept = accept
    input.style.display = 'none'
    const finish = (file: File | undefined): void => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => finish(input.files?.[0]), { once: true })
    input.addEventListener('cancel', () => finish(undefined), { once: true })
    document.body.append(input)
    input.click()
  })
}

/** Saves through a temporary link and chooses through a hidden file input. */
export const browserTransferHost: TransferHost = {
  save(file) {
    const url = URL.createObjectURL(new Blob([file.content], { type: file.type }))
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    // Some browsers read the URL after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  async pick(accept) {
    const file = await pickFile(accept)
    return file ? { name: file.name, content: await file.text() } : undefined
  },
  pickFile,
}
