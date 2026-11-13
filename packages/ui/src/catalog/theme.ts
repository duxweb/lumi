import { z } from 'zod'

export const THEME_MODES = ['light', 'dark', 'system'] as const
export const THEME_RADII = ['sm', 'md', 'lg'] as const
export const THEME_SEMANTIC_COLORS = ['success', 'warning', 'danger', 'info'] as const
export const THEME_FONT_SIZES = ['sm', 'md', 'lg'] as const
export const THEME_TYPE_STEPS = ['caption', 'label', 'body', 'title', 'section', 'page', 'metric'] as const

export type ThemeMode = typeof THEME_MODES[number]
export type ThemeRadius = typeof THEME_RADII[number]
export type ThemeSemanticColor = typeof THEME_SEMANTIC_COLORS[number]
export type ThemeFontSize = typeof THEME_FONT_SIZES[number]
export type ThemeTypeStep = typeof THEME_TYPE_STEPS[number]

const color = z.string().regex(/^#[\da-f]{6}$/i)
export const themeConfigSchema = z.strictObject({
  mode: z.enum(THEME_MODES).optional(),
  primary: color.optional(),
  brand: color.optional(),
  radius: z.enum(THEME_RADII).optional(),
  fontSize: z.enum(THEME_FONT_SIZES).optional(),
  fontSizes: z.partialRecord(z.enum(THEME_TYPE_STEPS), z.number().min(10).max(48)).optional(),
  neutral: color.optional(),
  success: color.optional(),
  warning: color.optional(),
  danger: color.optional(),
  info: color.optional(),
})
export type ThemeConfig = z.infer<typeof themeConfigSchema>
