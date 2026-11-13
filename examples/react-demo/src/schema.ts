import type { Spec } from '@json-render/core'

export const DEMO_SPEC: Spec = {
  root: 'page',
  state: { form: { name: 'Lumi', enabled: true }, saved: false },
  elements: {
    page: {
      type: 'Fragment',
      props: {},
      children: ['intro', 'form', 'result', 'packages'],
    },
    intro: {
      type: 'Card',
      props: {
        title: 'Lumi React',
        description: 'Native json-render with Lumi UI.',
      },
      children: [],
    },
    form: {
      type: 'Form',
      props: {},
      on: {
        submit: {
          action: 'setState',
          params: { statePath: '/saved', value: true },
        },
      },
      children: ['name', 'enabled', 'save'],
    },
    name: {
      type: 'FormField',
      props: {
        name: 'name',
        label: 'Name',
        fieldType: 'string',
        value: { $bindState: '/form/name' },
        checks: [{ type: 'required', message: 'Name is required' }],
      },
      children: [],
    },
    enabled: {
      type: 'FormField',
      props: {
        name: 'enabled',
        label: 'Enabled',
        widget: 'Switch',
        fieldType: 'boolean',
        value: { $bindState: '/form/enabled' },
      },
      children: [],
    },
    save: {
      type: 'Button',
      props: { label: 'Save', type: 'submit' },
      children: [],
    },
    result: {
      type: 'Alert',
      props: { tone: 'success', message: { $template: 'Saved $'.concat('{/form/name}') } },
      visible: { $state: '/saved' },
      children: [],
    },
    packages: {
      type: 'Table',
      props: {
        columns: [
          { field: 'name', label: 'Package' },
          { field: 'status', label: 'Status' },
        ],
        rows: [
          { name: 'json-render', status: 'Ready' },
          { name: 'Lumi UI', status: 'Ready' },
        ],
      },
      children: [],
    },
  },
}
