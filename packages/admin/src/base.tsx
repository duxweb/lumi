/// <reference types="vite/client" />
// Entry of the prebuilt base script (`dist/base/lumi-admin.js`). It bundles
// React, json-render, Lumi, Lumi UI and the Admin with their styles, so a
// backend serves one script and one stylesheet — from its own disk or a CDN —
// and describes everything else in JSON, or in plain JavaScript modules that
// need no bundler either. It is not part of the package's import graph.
import type { ComponentType } from 'react'
import type { AdminBaseConfig } from './base-config.js'
import type { AdminExtension } from './react/extensions.js'
import type { AdminModulePageProps } from './react/modulePage.js'
import type { AdminExtensionContext, MountedAdmin } from './react/mountAdmin.js'
import * as lumi from '@duxweb/lumi'
import * as ui from '@duxweb/lumi-ui'
import * as jsonRender from '@json-render/react'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { z } from 'zod'
import { composeAdminExtensions } from './react/extensions.js'
import * as admin from './react/index.js'
import { mountAdmin, resolveAdminBaseConfig } from './react/mountAdmin.js'
import '@duxweb/lumi-ui/style.css'
import '@duxweb/lumi-admin/style.css'

export type { AdminExtensionContext } from './react/mountAdmin.js'

/**
 * The libraries inside the base, handed to every extension module and kept on
 * `window.LumiAdmin.runtime`. Extension code uses these instead of its own
 * copies, so hooks see the same React and the same Lumi context.
 */
export const runtime = { React, jsx: jsxRuntime, lumi, ui, admin, jsonRender, z }
export type LumiAdminRuntime = typeof runtime

/** An extension module: an extension, or a function of the runtime returning one. */
export type AdminExtensionModule = AdminExtension | ((runtime: LumiAdminRuntime, context: AdminExtensionContext) => AdminExtension | Promise<AdminExtension>)

declare global {
  interface Window {
    /** Inline configuration, set before the base script loads. */
    LumiAdminConfig?: AdminBaseConfig | string
    /**
     * What JSON cannot carry: callbacks, providers, components. Scripts that
     * run before the base may each add one with
     * `(window.LumiAdminSetup ||= []).push(extension)`.
     */
    LumiAdminSetup?: AdminExtensionModule | AdminExtensionModule[]
    LumiAdmin?: LumiAdminGlobal
  }
}

export interface LumiAdminGlobal {
  runtime: LumiAdminRuntime
  /**
   * Boots an Admin; `extensions` apply after the modules the config lists.
   * Mounting again first unmounts the Admin mounted before.
   */
  mount: (config: string | AdminBaseConfig, ...extensions: AdminExtensionModule[]) => Promise<MountedAdmin>
  resolveConfig: typeof resolveAdminBaseConfig
  /**
   * Adds extensions to the next mount, for scripts that run after the base.
   * They apply after the config's modules and `LumiAdminSetup`, in the order
   * added; adding one after mount only warns.
   */
  use: (...extensions: AdminExtensionModule[]) => void
  /** The instance booted from the page's own configuration, once mounted. */
  current?: MountedAdmin
}

const CONFIG_SCRIPT_ID = 'lumi-admin-config'

async function resolveExtension(entry: AdminExtensionModule, context: AdminExtensionContext): Promise<AdminExtension> {
  return typeof entry === 'function' ? await entry(runtime, context) : entry
}

/**
 * A `page.module` in the base: like an extension module, its default export
 * receives the runtime, and returns the page component.
 */
async function importPageModule(url: string): Promise<ComponentType<AdminModulePageProps>> {
  const loaded = await import(/* @vite-ignore */ new URL(url, document.baseURI).href) as { default?: unknown }
  if (typeof loaded.default !== 'function')
    throw new Error(`[lumi] page module ${url} has no default export`)
  const Page: unknown = await (loaded.default as (runtime: LumiAdminRuntime) => unknown)(runtime)
  if (typeof Page !== 'function')
    throw new Error(`[lumi] page module ${url} returns no component`)
  return Page as ComponentType<AdminModulePageProps>
}

async function importModule(url: string, context: AdminExtensionContext): Promise<AdminExtension> {
  const loaded = await import(/* @vite-ignore */ new URL(url, document.baseURI).href) as { default?: AdminExtensionModule }
  if (!loaded.default)
    throw new Error(`[lumi] extension module ${url} has no default export`)
  return resolveExtension(loaded.default, context)
}

/**
 * The page names its configuration in one of three ways, checked in order:
 *   <script>window.LumiAdminConfig = { … }</script>
 *   <script type="application/json" id="lumi-admin-config">{ … }</script>
 *   <script type="module" src="lumi-admin.js" data-config="/admin/config.json"></script>
 * `window.LumiAdminSetup` may sit beside any of them with what JSON cannot
 * hold. With no configuration the base waits for `LumiAdmin.mount(…)`.
 */
function pageConfig(): string | AdminBaseConfig | undefined {
  if (window.LumiAdminConfig)
    return window.LumiAdminConfig
  const block = document.getElementById(CONFIG_SCRIPT_ID)
  if (block?.textContent?.trim())
    return JSON.parse(block.textContent) as AdminBaseConfig
  return document.querySelector<HTMLScriptElement>('script[data-config]')?.dataset.config
}

/**
 * A page that serves one panel only names it on the base script:
 *   <script type="module" src="lumi-admin.js" data-config="/config.json" data-panel="merchant"></script>
 * Otherwise the panel follows the address.
 */
function pagePanel(): { panel?: string } {
  const panel = document.querySelector<HTMLScriptElement>('script[data-panel]')?.dataset.panel
  return panel ? { panel } : {}
}

// Extensions added with LumiAdmin.use(), taken by the next mount.
const queued: AdminExtensionModule[] = []

const api: LumiAdminGlobal = {
  runtime,
  mount: async (source, ...extensions) => {
    const { modules, ...config } = await resolveAdminBaseConfig(source)
    const added = queued.splice(0)
    api.current?.unmount()
    // Modules receive the app's request client, so they load inside the mount;
    // they load in parallel but apply in order: the config's modules, the
    // page's own extensions, then those added with use().
    api.current = await mountAdmin(config, async (context) => {
      const loaded = await Promise.all([
        ...(modules ?? []).map(url => importModule(url, context)),
        ...[...extensions, ...added].map(entry => resolveExtension(entry, context)),
      ])
      // Built in first, so an extension may load page modules its own way.
      return composeAdminExtensions([{ loadPageModule: importPageModule }, ...loaded])
    }, pagePanel())
    return api.current
  },
  resolveConfig: resolveAdminBaseConfig,
  use: (...extensions) => {
    if (api.current) {
      console.warn('[lumi] LumiAdmin.use() after mount has no effect; add extensions before the Admin mounts')
      return
    }
    queued.push(...extensions)
  },
}
window.LumiAdmin = api

function setupExtensions(): AdminExtensionModule[] {
  const setup = window.LumiAdminSetup
  return setup === undefined ? [] : Array.isArray(setup) ? setup : [setup]
}

const config = pageConfig()
if (config) {
  // Mount once the page has parsed, so module scripts after the base can
  // still call LumiAdmin.use() first.
  const boot = (): void => {
    api.mount(config, ...setupExtensions()).catch((error: unknown) => {
      console.error(error)
      const node = document.querySelector('#app') ?? document.body
      node.textContent = error instanceof Error ? error.message : String(error)
    })
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  else
    setTimeout(boot, 0)
}
