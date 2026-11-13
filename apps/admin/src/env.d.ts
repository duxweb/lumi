/// <reference types="vite/client" />

declare module '*.css'

interface ImportMetaEnv {
  /** `browser` runs the demo backend in the page; see `src/browser-mock.ts`. */
  readonly VITE_LUMI_ADMIN_MOCK?: string
}
