import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { translations } from '../../lumi/src/core/providers/messages.js'
import { adminTranslations } from '../src/menu.js'

const SOURCE_ROOTS = ['../ui/src', 'src'].map(path => new URL(`../${path}`, import.meta.url).pathname)
const KEY = /'(lumi\.[a-z][A-Za-z]*\.[A-Za-z_.]+)'/g
const T_CALL = /\bt\(\s*'(lumi\.[^']+)',\s*'((?:[^'\\]|\\.)*)'/g
const TRANSLATE_CALL = /\btranslate\(\s*'(lumi\.[^']+)',\s*(?:undefined|\{[^}]*\}),\s*'((?:[^'\\]|\\.)*)'/g
const PLACEHOLDER = /\{(\w+)\}/g

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return sources(path)
    return /\.tsx?$/.test(name) ? [readFileSync(path, 'utf8')] : []
  })
}

const code = SOURCE_ROOTS.flatMap(sources).filter(text => !text.includes('export const adminTranslations'))
const en = { ...translations['en-US'], ...adminTranslations['en-US'] } as Record<string, string>
const zh = { ...translations['zh-CN'], ...adminTranslations['zh-CN'] } as Record<string, string>
const placeholders = (text: string): string[] => Array.from(text.matchAll(PLACEHOLDER), match => match[1]!).sort()

describe('i18n catalogs', () => {
  it('holds every key the UI and Admin sources use', () => {
    const used = new Set(code.flatMap(text => Array.from(text.matchAll(KEY), match => match[1]!)))
    expect([...used].filter(key => !(key in en))).toEqual([])
  })

  it('keeps each English fallback equal to its catalog entry', () => {
    const calls = code.flatMap(text => [...text.matchAll(T_CALL), ...text.matchAll(TRANSLATE_CALL)])
    expect(calls.length).toBeGreaterThan(100)
    expect(calls.filter(call => en[call[1]!] !== call[2]).map(call => `${call[1]}: ${call[2]}`)).toEqual([])
  })

  it('translates every entry with the same placeholders', () => {
    expect(Object.keys(en).filter(key => !zh[key])).toEqual([])
    expect(Object.keys(en).filter(key => placeholders(en[key]!).join() !== placeholders(zh[key]!).join())).toEqual([])
  })
})
