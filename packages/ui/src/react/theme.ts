import type { ThemeConfig, ThemeFontSize, ThemeRadius } from '../catalog/theme.js'
import { THEME_SEMANTIC_COLORS } from '../catalog/theme.js'

const RADIUS_VALUES: Record<ThemeRadius, string> = {
  sm: '0.375rem',
  md: '0.625rem',
  lg: '0.875rem',
}

const FONT_SIZE_VALUES: Record<ThemeFontSize, string> = {
  sm: '15px',
  md: '16px',
  lg: '17px',
}

export interface LumiThemeController {
  config: ThemeConfig
  dispose: () => void
}

/** The CSS variables a theme config sets. */
export function themeToCssVariables(config: ThemeConfig): Record<string, string> {
  const variables: Record<string, string> = {}
  if (config.primary)
    variables['--lumi-theme-primary'] = config.primary
  if (config.brand)
    variables['--lumi-theme-brand'] = config.brand
  if (config.neutral)
    variables['--lumi-theme-neutral'] = config.neutral
  if (config.radius)
    variables['--lumi-theme-radius'] = RADIUS_VALUES[config.radius]
  if (config.fontSize)
    variables['--lumi-theme-font-size'] = FONT_SIZE_VALUES[config.fontSize]
  for (const [step, size] of Object.entries(config.fontSizes ?? {})) {
    if (typeof size === 'number')
      variables[`--lumi-theme-font-${step}`] = `${size}px`
  }
  for (const name of THEME_SEMANTIC_COLORS) {
    const seed = config[name]
    if (seed)
      variables[`--lumi-theme-${name}`] = seed
  }
  return variables
}

/** Applies a theme to the document (or `target`): its CSS variables and its colour mode, following the system for `system`. `dispose` restores what was there. */
export function applyLumiTheme(config: ThemeConfig, target?: HTMLElement): LumiThemeController {
  const element = target ?? (typeof document !== 'undefined' ? document.documentElement : undefined)
  if (!element)
    return { config, dispose: () => {} }

  const variables = themeToCssVariables(config)
  const previous = new Map<string, string>()
  for (const [name, value] of Object.entries(variables)) {
    previous.set(name, element.style.getPropertyValue(name))
    element.style.setProperty(name, value)
  }

  const previousTheme = element.dataset.theme
  const previousDark = element.classList.contains('dark')
  const preference = config.mode ?? 'system'
  const media = preference === 'system' && typeof matchMedia !== 'undefined'
    ? matchMedia('(prefers-color-scheme: dark)')
    : undefined
  const applyMode = (): void => {
    const resolved = preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference
    element.dataset.theme = resolved
    element.classList.toggle('dark', resolved === 'dark')
  }
  applyMode()
  media?.addEventListener('change', applyMode)

  return {
    config,
    dispose() {
      media?.removeEventListener('change', applyMode)
      if (previousTheme === undefined)
        delete element.dataset.theme
      else
        element.dataset.theme = previousTheme
      element.classList.toggle('dark', previousDark)
      for (const [name, value] of previous) {
        if (value)
          element.style.setProperty(name, value)
        else
          element.style.removeProperty(name)
      }
    },
  }
}
