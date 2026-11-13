import type { Spec } from '@json-render/core'
import actionsArrays from './specs/actions-arrays.json' with { type: 'json' }
import actionsFeedback from './specs/actions-feedback.json' with { type: 'json' }
import actionsMutations from './specs/actions-mutations.json' with { type: 'json' }
import actionsRequest from './specs/actions-request.json' with { type: 'json' }
import actionsSetState from './specs/actions-set-state.json' with { type: 'json' }
import actionsSubmit from './specs/actions-submit.json' with { type: 'json' }
import agent from './specs/agent-output.json' with { type: 'json' }
import errorsFields from './specs/errors-fields.json' with { type: 'json' }
import errorsOutage from './specs/errors-outage.json' with { type: 'json' }
import errorsUnhandled from './specs/errors-unhandled.json' with { type: 'json' }
import broken from './specs/json-broken.json' with { type: 'json' }
import queryAggregate from './specs/query-aggregate.json' with { type: 'json' }
import queryDetail from './specs/query-detail.json' with { type: 'json' }
import queryList from './specs/query-list.json' with { type: 'json' }
import queryPages from './specs/query-pages.json' with { type: 'json' }
import startAdmin from './specs/start-admin.json' with { type: 'json' }
import startI18n from './specs/start-i18n.json' with { type: 'json' }
import startServices from './specs/start-services.json' with { type: 'json' }
import startStructure from './specs/start-structure.json' with { type: 'json' }
import stateBind from './specs/state-bind.json' with { type: 'json' }
import stateCond from './specs/state-cond.json' with { type: 'json' }
import stateRepeat from './specs/state-repeat.json' with { type: 'json' }
import stateVisible from './specs/state-visible.json' with { type: 'json' }
import stateWatch from './specs/state-watch.json' with { type: 'json' }
import stats from './specs/ui-stats.json' with { type: 'json' }
import upload from './specs/upload.json' with { type: 'json' }

// Native Specs for the showcase, kept as plain JSON exactly as a backend would
// return them, one document per file. They are rendered as-is next to their
// output, validated in test/json-specs.test.ts and checked by lumi-check in
// `pnpm check:schema`.

const specs = <K extends string>(map: Record<K, unknown>): Readonly<Record<K, Spec>> => map as Record<K, Spec>

/** Developer pages: one map per page, one Spec per example. */
export const startSpecs = specs({ structure: startStructure, services: startServices, i18n: startI18n, admin: startAdmin })
export const stateSpecs = specs({ bind: stateBind, visible: stateVisible, cond: stateCond, repeat: stateRepeat, watch: stateWatch })
export const actionSpecs = specs({ setState: actionsSetState, arrays: actionsArrays, feedback: actionsFeedback, request: actionsRequest, mutations: actionsMutations, submit: actionsSubmit })
export const querySpecs = specs({ list: queryList, pages: queryPages, detail: queryDetail, aggregate: queryAggregate })
export const errorSpecs = specs({ fields: errorsFields, outage: errorsOutage, unhandled: errorsUnhandled })
export const uploadSpec = upload as Spec
export const statsSpec = stats as Spec
/** What a model returned for "show me large unpaid orders". */
export const agentSpec = agent as Spec
/** Deliberately broken Spec for the validation examples. */
export const brokenSpec: unknown = broken
