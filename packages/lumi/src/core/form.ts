import type { FormValidationIssue } from './validation'
import { pathMatchesFields } from './path'

export interface FormGroupDefinition {
  fields: readonly string[]
}

export interface FormErrorGroup {
  errors: FormValidationIssue[]
  count: number
  firstError?: string
}

export interface FormDraftStore<T extends Record<string, unknown> = Record<string, unknown>> {
  get: (key: string) => T | undefined
  set: (key: string, values: T) => void
  delete: (key: string) => void
  has: (key: string) => boolean
}

export interface FormDraftOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  key: string
  store: FormDraftStore<T>
}

export interface FormValidateOptions {
  fields?: readonly string[]
}

/** The errors of `fields`, or all of them when no fields are named. */
export function errorsForFields(errors: readonly FormValidationIssue[], fields?: readonly string[]): FormValidationIssue[] {
  return fields ? errors.filter(error => pathMatchesFields(error.path, fields)) : [...errors]
}

/** The current errors with those of `fields` replaced by the new ones; every error is replaced when no fields are named. */
export function replaceFieldErrors(current: readonly FormValidationIssue[], next: readonly FormValidationIssue[], fields?: readonly string[]): FormValidationIssue[] {
  if (!fields)
    return [...next]
  return [
    ...current.filter(error => !pathMatchesFields(error.path, fields)),
    ...next.filter(error => pathMatchesFields(error.path, fields)),
  ]
}

/** The path of the first error, among `fields` when named. */
export function firstFormError(errors: readonly FormValidationIssue[], fields?: readonly string[]): string | undefined {
  return errorsForFields(errors, fields)[0]?.path
}

/** Each group's errors, their count and the path of the first. */
export function groupFormErrors(errors: readonly FormValidationIssue[], groups: Record<string, FormGroupDefinition> = {}): Record<string, FormErrorGroup> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => {
    const matched = errorsForFields(errors, group.fields)
    return [name, { errors: matched, count: matched.length, firstError: matched[0]?.path }]
  }))
}
