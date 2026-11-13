import type { Spec } from '@json-render/core'
import overview from './overview.json'
import agent from './specs/agent.json'
import choice from './specs/choice.json'
import composition from './specs/composition.json'
import data from './specs/data.json'
import feedback from './specs/feedback.json'
import standard from './specs/standard.json'
import surfaces from './specs/surfaces.json'
import text from './specs/text.json'

export interface GalleryPageDef { label: string, path: string, icon: string, description: string, spec: Spec }
export const GALLERY_PAGES: Record<string, GalleryPageDef> = {
  standard: { ...{ label: 'Standard components', path: '/ui/standard', icon: 'blocks', description: 'Every public UI component in one native Spec, shared by the reference documentation.' }, spec: standard },
  text: { ...{ label: 'Text controls', path: '/ui/text', icon: 'type', description: 'Controls that take typed input: text, numbers and dates, in every size, appearance and state' }, spec: text },
  choice: { ...{ label: 'Choice controls', path: '/ui/choice', icon: 'list-checks', description: 'Controls that take a choice from a set: selects, radios, checkboxes, switches and uploads' }, spec: choice },
  composition: { ...{ label: 'Form composition', path: '/ui/composition', icon: 'square-stack', description: 'How controls are assembled: Form and FormField, the Filters toolbar, and the layout Fragment' }, spec: composition },
  data: { ...{ label: 'Data display', path: '/ui/data', icon: 'table', description: 'Reading surfaces: typed table columns, key/value pairs, pagination, timeline and stepper' }, spec: data },
  feedback: { ...{ label: 'Actions and feedback', path: '/ui/feedback', icon: 'bell', description: 'Buttons in every appearance, and badges and alerts across all six tones' }, spec: feedback },
  agent: { ...{ label: 'Agent', path: '/ui/agent', icon: 'sparkles', description: 'Agent conversation: messages, the composer, activity, tool calls, approvals, questions, plans, diffs and context' }, spec: agent as Spec },
  surfaces: { ...{ label: 'Surfaces and overlays', path: '/ui/surfaces', icon: 'layers', description: 'Cards, Frames, Tabs and the two overlays — dialog for a decision, drawer for a side task' }, spec: surfaces },
}

export interface ComponentOverviewCategory { name: string, label: string }

/** One component in the overview: a thumbnail Spec plus what a gallery tile shows about it. */
export interface ComponentOverviewEntry {
  /** The Catalog component type. */
  name: string
  /** The package whose registry renders the thumbnail: `@duxweb/lumi-ui` or `@duxweb/lumi-admin`. */
  package: string
  /** A `categories` name. */
  category: string
  /** One English line; hosts translate it as a message key. */
  description: string
  /** The component's demo section in the React Admin showcase. */
  href: string
  /** Shrinks a thumbnail that is larger than a tile, e.g. `0.75`. */
  scale?: number
  /** A small native Spec of the real component; static, nothing in it needs data services. */
  spec: Spec
}

export interface ComponentOverview {
  categories: ComponentOverviewCategory[]
  components: ComponentOverviewEntry[]
}

// The inferred JSON type unions the entries and pads absent keys with `undefined`,
// which a Spec's element map rejects; apps/admin/test validates every Spec instead.
export const COMPONENT_OVERVIEW = overview as unknown as ComponentOverview
