import antfu from '@antfu/eslint-config'

// Package boundary rules. Flat config does not merge options for one rule across
// matching blocks (the last match wins), so every block lists its full ban set.
// The core rule also reports `import type` and `export ... from` declarations.
const frameworkImports = {
  group: [
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
    '@json-render/react',
    '@json-render/react/*',
    '@tanstack/react-*',
    './react',
    './react/*',
    '../react',
    '../react/*',
    '../../react/*',
  ],
  message: '/catalog entrypoints and Lumi core must stay framework-free: no React, framework renderers, or React package roots (use the /catalog subpaths).',
}
// React package roots, matched exactly so their /catalog subpaths stay allowed.
const reactRoots = ['@duxweb/lumi', '@duxweb/lumi-ui', '@duxweb/lumi-ui/charts', '@duxweb/lumi-admin']
  .map(name => ({ name, message: frameworkImports.message }))
const uiImports = {
  group: ['@duxweb/lumi-ui', '@duxweb/lumi-ui/*'],
  message: '@duxweb/lumi must not depend on Lumi UI.',
}
const adminImports = {
  group: ['@duxweb/lumi-admin', '@duxweb/lumi-admin/*'],
  message: 'Lumi and Lumi UI must not depend on Lumi Admin.',
}
const uiPrivateImports = {
  group: [
    '@duxweb/lumi-ui/internal',
    '@duxweb/lumi-ui/internal/*',
    '**/packages/ui/src/internal',
    '**/packages/ui/src/internal/*',
    '**/ui/src/internal',
    '**/ui/src/internal/*',
    'radix-ui',
    'radix-ui/*',
    '@radix-ui/*',
    'vaul',
    'vaul/*',
  ],
  message: 'Use the public @duxweb/lumi-ui components; raw Radix/vaul and UI internals stay private to packages/ui.',
}

function restrict(...patterns) {
  return { 'no-restricted-imports': ['error', { patterns }] }
}
function restrictFrameworkFree(...patterns) {
  return { 'no-restricted-imports': ['error', { paths: reactRoots, patterns: [frameworkImports, ...patterns] }] }
}

const lumiFrameworkFree = [
  'packages/lumi/src/catalog.ts',
  'packages/lumi/src/config-validation.ts',
  'packages/lumi/src/loader.ts',
  'packages/lumi/src/pack.ts',
  'packages/lumi/src/validation.ts',
  'packages/lumi/src/catalog/**/*.{ts,tsx}',
  'packages/lumi/src/core/**/*.{ts,tsx}',
]
const uiFrameworkFree = ['packages/ui/src/catalog.ts', 'packages/ui/src/catalog/**/*.{ts,tsx}']
const adminFrameworkFree = [
  'packages/admin/src/catalog.ts',
  'packages/admin/src/catalog/**/*.{ts,tsx}',
  'packages/admin/src/config.ts',
  'packages/admin/src/loader.ts',
  'packages/admin/src/menu.ts',
]
const uiConsumers = ['packages/admin/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx,mjs}', 'examples/*/src/**/*.{ts,tsx}']

export default antfu(
  {
    type: 'lib',
    typescript: true,
    vue: false,
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },
    ignores: [
      '**/dist/**',
      '**/.astro/**',
      '**/node_modules/**',
      '**/target/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.md',
      'packages/create/templates/**',
    ],
  },
  { name: 'lumi/boundaries/lumi', files: ['packages/lumi/**/*.{ts,tsx,mjs}'], rules: restrict(uiImports, adminImports) },
  { name: 'lumi/boundaries/lumi-catalog', files: lumiFrameworkFree, rules: restrictFrameworkFree(uiImports, adminImports) },
  { name: 'lumi/boundaries/ui', files: ['packages/ui/**/*.{ts,tsx,mjs}'], rules: restrict(adminImports) },
  { name: 'lumi/boundaries/ui-catalog', files: uiFrameworkFree, rules: restrictFrameworkFree(adminImports) },
  { name: 'lumi/boundaries/ui-consumers', files: uiConsumers, rules: restrict(uiPrivateImports) },
  { name: 'lumi/boundaries/admin-catalog', files: adminFrameworkFree, rules: restrictFrameworkFree(uiPrivateImports) },
)
