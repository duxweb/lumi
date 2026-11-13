import type { ValidationIssue } from '@duxweb/lumi'
import { createI18nProvider, formatIssues } from '@duxweb/lumi'
import { describe, expect, it } from 'vitest'
import { createJsonSchemaValidator } from '../../src/validation-json-schema.js'

describe('json schema form validator', () => {
  it('returns stable issues for nested, required, and formatted values', () => {
    const validator = createJsonSchemaValidator()
    const rules = {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
          },
          required: ['name', 'email'],
        },
      },
      required: ['profile'],
    }

    expect(validator.validate(rules, { profile: { name: 'A', email: 'invalid' } })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'profile.name', code: 'min_length', params: { limit: 2 } }),
      expect.objectContaining({ path: 'profile.email', code: 'invalid_format', params: { format: 'email' } }),
    ]))
    expect(validator.validate(rules, { profile: {} })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'profile.name', code: 'required' }),
      expect.objectContaining({ path: 'profile.email', code: 'required' }),
    ]))
  })

  it('preserves JSON Pointer property names in structured issue paths', () => {
    const validator = createJsonSchemaValidator()
    const rules = {
      type: 'object',
      properties: {
        'profile.name': { type: 'string', minLength: 2 },
        'nested': {
          type: 'object',
          properties: { 'a/b': { type: 'string' } },
          required: ['a/b'],
        },
      },
    }

    expect(validator.validate(rules, { 'profile.name': 'A', 'nested': {} })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'profile.name', code: 'min_length' }),
      expect.objectContaining({ path: 'nested.a/b', code: 'required' }),
    ]))
  })

  it('skips forms without rules', () => {
    expect(createJsonSchemaValidator().validate(undefined, {})).toEqual([])
  })

  it('normalizes standard collection and numeric errors for localization', () => {
    const validator = createJsonSchemaValidator()
    const rules = {
      type: 'object',
      properties: {
        code: { const: 'LUMI' },
        tags: { type: 'array', minItems: 2, uniqueItems: true },
        count: { type: 'number', multipleOf: 5, exclusiveMinimum: 0 },
      },
    }

    expect(validator.validate(rules, { code: 'OTHER', tags: ['same', 'same'], count: 3 })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'code', code: 'invalid_const', params: { expected: 'LUMI' }, message: undefined }),
      expect.objectContaining({ path: 'tags', code: 'unique_items', message: undefined }),
      expect.objectContaining({ path: 'count', code: 'multiple_of', params: { limit: 5 }, message: undefined }),
    ]))
  })

  it('normalizes composite and object errors without leaking Ajv messages', () => {
    const validator = createJsonSchemaValidator()
    const rules = {
      type: 'object',
      properties: {
        choice: { oneOf: [{ const: 'A' }, { const: 'B' }] },
        flags: { type: 'array', contains: { const: 'enabled' } },
        account: {
          type: 'object',
          properties: { email: { type: 'string' }, notify: { type: 'boolean' } },
          dependencies: { email: ['notify'] },
        },
        metadata: {
          type: 'object',
          propertyNames: { pattern: '^[a-z]+$' },
        },
      },
    }

    const issues = validator.validate(rules, {
      account: { email: 'team@example.com' },
      choice: 'C',
      flags: ['disabled'],
      metadata: { 'Invalid-Key': true },
    })

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'choice', code: 'one_of', message: undefined }),
      // No upper bound: its own code, so the message never shows an unfilled `{max}`.
      expect.objectContaining({ path: 'flags', code: 'contains_min', params: { min: 1 }, message: undefined }),
      expect.objectContaining({ path: 'account', code: 'dependency', params: { property: 'email', required: 'notify' }, message: undefined }),
      expect.objectContaining({ path: 'metadata.Invalid-Key', code: 'invalid_property_name', message: undefined }),
    ]))
  })

  it('supports JSON Schema 2020-12 dependent and contains keywords', () => {
    const validator = createJsonSchemaValidator()
    const rules = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        account: {
          type: 'object',
          properties: {
            billingAddress: { type: 'string' },
            email: { type: 'string' },
            notify: { type: 'boolean' },
          },
          dependentRequired: { email: ['notify'] },
          dependentSchemas: {
            email: { required: ['billingAddress'] },
          },
        },
        tags: {
          type: 'array',
          contains: { const: 'enabled' },
          minContains: 2,
          maxContains: 2,
        },
      },
    }

    expect(validator.validate(rules, {
      account: { email: 'team@example.com' },
      tags: ['enabled', 'disabled'],
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'account', code: 'dependency', params: { property: 'email', required: 'notify' } }),
      expect.objectContaining({ path: 'account.billingAddress', code: 'required' }),
      expect.objectContaining({ path: 'tags', code: 'contains', params: { min: 2, max: 2 } }),
    ]))
  })

  it('localizes field messages without naming the field', () => {
    const rules = {
      type: 'object',
      required: ['name'],
      properties: {
        stock: { type: 'integer', minimum: 1 },
        code: { type: 'string', minLength: 3, pattern: '^[A-Z]+$' },
        tier: { enum: ['basic', 'pro'] },
        email: { type: 'string', format: 'email' },
      },
    }
    const issues = createJsonSchemaValidator().validate(rules, { stock: 0, code: 'a', tier: 'gold', email: 'nope' }) as ValidationIssue[]
    const messages = (locale: string): Record<string, string> => Object.fromEntries(
      formatIssues(issues, createI18nProvider({ locale }).translate).map(issue => [`${issue.path}:${issue.code}`, issue.message]),
    )

    expect(messages('en-US')).toEqual({
      'name:required': 'This field is required',
      'stock:minimum': 'Must be at least 1',
      'code:min_length': 'Must contain at least 3 characters',
      'code:invalid_pattern': 'Invalid format',
      'tier:invalid_enum': 'Must be one of basic,pro',
      'email:invalid_format': 'Must be a valid email',
    })
    expect(messages('zh-CN')).toEqual({
      'name:required': '此项为必填项',
      'stock:minimum': '不能小于 1',
      'code:min_length': '至少需要 3 个字符',
      'code:invalid_pattern': '格式不正确',
      'tier:invalid_enum': '必须是以下值之一：basic,pro',
      'email:invalid_format': '必须是有效的 email',
    })
  })
})

describe('json schema validator rules', () => {
  it('words a contains rule by the bounds it has', () => {
    const validator = createJsonSchemaValidator()
    const flags = (extra: object) => ({ type: 'object', properties: { flags: { type: 'array', contains: { const: 'on' }, ...extra } } })
    expect(formatIssues(validator.validate(flags({}), { flags: [] }) as ValidationIssue[])[0]!.message).toBe('Must contain at least 1 matching items')
    expect(formatIssues(validator.validate(flags({ minContains: 2, maxContains: 3 }), { flags: ['on'] }) as ValidationIssue[])[0]!.message).toBe('Must contain between 2 and 3 matching items')
  })

  it('reuses the compiled rules when the same rules arrive as a new object, as they do on every submit', () => {
    const validator = createJsonSchemaValidator()
    const rules = () => ({ $id: 'https://example.com/customer', type: 'object', required: ['name'], properties: { name: { type: 'string' } } })
    expect(validator.validate(rules(), {})).toEqual([expect.objectContaining({ path: 'name', code: 'required' })])
    // A second compile of a schema with the same `$id` would throw.
    expect(validator.validate(rules(), { name: 'Ada' })).toEqual([])
    expect(validator.validate(rules(), {})).toHaveLength(1)
  })
})
