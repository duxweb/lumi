import type { MountedAdmin } from '@duxweb/lumi-admin'

// The mounted Admin, for the few showcase pages that call the API by hand.
let mounted: MountedAdmin | undefined

export function setMountedAdmin(admin: MountedAdmin): void {
  mounted = admin
}

export function mountedAdmin(): MountedAdmin | undefined {
  return mounted
}

export function apiUrl(): string {
  return mountedPanel().defaultData.url
}

/** The mounted panel: its backend, sign-in and permission rule from the deployment config. */
export function mountedPanel(): MountedAdmin['panel'] {
  if (!mounted)
    throw new Error('[demo] the Admin is not mounted yet')
  return mounted.panel
}
