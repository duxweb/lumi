export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type TextValue = string
export type TextTranslator = (key: string, params?: Record<string, JsonValue>, defaultMessage?: string) => string
