import { describe, expect, it } from 'vitest'
import { assignOwnProperties, getPathValue, pathContains, pathMatchesFields, setPathValue } from '../../src/core/index'

describe('data paths', () => {
  it('matches nested and array field boundaries without prefix collisions', () => {
    expect(pathContains('items.0', 'items.0.quantity')).toBe(true)
    expect(pathContains('items.0', 'items.01.quantity')).toBe(false)
    expect(pathMatchesFields('profile', ['profile.name'])).toBe(true)
    expect(pathMatchesFields('profile.name', ['profile'])).toBe(true)
    expect(pathMatchesFields('profileName', ['profile'])).toBe(false)
  })
  it('reads nested objects and array indexes', () => {
    const value = { profile: { name: 'Lumi' }, items: [{ quantity: 2 }] }

    expect(getPathValue(value, 'profile.name')).toBe('Lumi')
    expect(getPathValue(value, 'items.0.quantity')).toBe(2)
    expect(getPathValue(value, 'items.1.quantity')).toBeUndefined()
  })

  it('immutably creates and updates nested containers', () => {
    const value = { profile: { name: 'Old' }, items: [{ quantity: 1 }] }
    const renamed = setPathValue(value, 'profile.name', 'New')
    const updated = setPathValue(renamed, 'items.0.quantity', 3)
    const appended = setPathValue(updated, 'items.1.quantity', 5)

    expect(appended).toEqual({ profile: { name: 'New' }, items: [{ quantity: 3 }, { quantity: 5 }] })
    expect(value).toEqual({ profile: { name: 'Old' }, items: [{ quantity: 1 }] })
  })

  it('rejects unsafe or ambiguous paths', () => {
    expect(() => setPathValue({}, '__proto__.polluted', true)).toThrow('invalid data path')
    expect(() => getPathValue({}, 'profile..name')).toThrow('invalid data path')
  })

  it('copies prototype-shaped JSON keys as ordinary own properties', () => {
    const target = {}
    const source = JSON.parse('{"__proto__":{"polluted":true},"constructor":"literal"}')

    assignOwnProperties(target, source)

    expect(Object.getPrototypeOf(target)).toBe(Object.prototype)
    expect(Object.hasOwn(target, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(target, '__proto__')?.value).toEqual({ polluted: true })
    expect(Object.getOwnPropertyDescriptor(target, 'constructor')?.value).toBe('literal')
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})
