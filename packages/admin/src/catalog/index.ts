import type { FilterOption, TreeNode } from '@duxweb/lumi-ui/catalog'
import {
  agentContextItemSchema,
  chartComponentDefinition,
  treeNodeSchema,
  uiComponentDefinitions,
} from '@duxweb/lumi-ui/catalog'
import { composeDefinitions, dataTargetSchema, lumiActionDefinitions, lumiComponentDefinitions, optionsSourceSchema, queryPropsSchema, treeSourceSchema, uploadRequestSchema } from '@duxweb/lumi/catalog'
import { z } from 'zod'
import { promptMentionsSchema } from '../config.js'

const recoverableState = z.strictObject({
  kind: z.enum(['empty', 'error', 'permission', 'offline', 'timeout']),
  title: z.string(),
  reason: z.string(),
  nextStep: z.string(),
  actionLabel: z.string().optional(),
  disabled: z.boolean().optional(),
})
const state = z
  .union([
    recoverableState,
    z.strictObject({ kind: z.literal('idle') }),
    z.strictObject({
      kind: z.literal('loading'),
      label: z.string().optional(),
    }),
    z.strictObject({
      kind: z.literal('success'),
      title: z.string(),
      message: z.string(),
    }),
  ])
  .optional()
const tone = z.enum([
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
  'info',
])
const header = { title: z.string(), description: z.string().optional(), state }
export const adminComponentDefinitions = {
  DashboardPage: {
    props: z.strictObject({
      ...header,
      metrics: z
        .array(
          z.strictObject({
            key: z.string(),
            label: z.string(),
            value: z.union([z.string(), z.number()]),
            unit: z.string().optional(),
            icon: z.string().optional(),
            description: z.string().optional(),
            change: z.string().optional(),
            tone: tone.optional(),
            series: z.array(z.number()).optional(),
          }),
        )
        .optional(),
    }),
    slots: ['default', 'actions', 'meta'],
    events: [],
    description: 'Dashboard metrics and content panels.',
  },
  DetailPage: {
    props: z.strictObject({
      ...header,
      fields: z.array(
        z.strictObject({
          key: z.string(),
          label: z.string(),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          hint: z.string().optional(),
        }),
      ),
      timeline: uiComponentDefinitions.Timeline.props.optional(),
      timelineTitle: z.string().optional(),
    }),
    slots: ['default', 'actions', 'status'],
    events: [],
    description: 'Record summary, content and activity.',
  },
  SettingsPage: {
    props: z.strictObject({
      ...header,
      sections: z.array(
        z.strictObject({
          value: z.string(),
          label: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          disabled: z.boolean().optional(),
          content: z.string().optional(),
        }),
      ),
      value: z.string().optional(),
      dirty: z.boolean().optional(),
      navLabel: z.string().optional(),
    }),
    slots: ['default', 'actions', 'status'],
    events: ['change'],
    description:
      'Bound settings navigation. Default children can use visible to select section content.',
  },
  SettingsForm: {
    props: dataTargetSchema
      .extend({
        title: z.string(),
        description: z.string().optional(),
        id: z.union([z.string(), z.number()]).optional(),
        valuesPath: z.string().startsWith('/'),
        initialValues: z.record(z.string(), z.unknown()).optional(),
        fields: z.array(z.string()).optional(),
        rules: z.unknown().optional(),
        saveMode: z.enum(['auto', 'manual']).optional(),
        columns: z.union([z.literal(1), z.literal(2)]).optional(),
        saveLabel: z.string().optional(),
      })
      .strict(),
    slots: ['default'],
    events: ['saved'],
    description:
      'One settings card bound to a record. `auto` (default) saves each change through submitForm: choices on change, typed fields on blur or Enter, invalid values stay unsent. `manual` adds Discard and Save for changes that need confirmation. Bind fields to paths under valuesPath.',
  },
  DataGrid: {
    props: uiComponentDefinitions.Table.props.extend({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().nonnegative(),
      state: recoverableState.optional(),
      pageSizeOptions: z.array(z.number()).optional(),
    }),
    slots: ['rowActions'],
    events: [
      'pageChange',
      'pageSizeChange',
      'sort',
      'selectionChange',
      'rowClick',
      'rowAction',
      'bulkAction',
    ],
    description: 'Controlled Admin results grid with pagination. `rowActions` works as on Table. `bulkActions` show a selection bar over the grid; `bulkAction` binds the pressed value to `activeAction`.',
  },
  FilterBar: {
    props: uiComponentDefinitions.Filters.props.extend({
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    slots: ['toolbarStart', 'toolbarEnd'],
    events: ['change'],
    description: 'Admin filter toolbar. Bind value to query filters.',
  },
  EmptyState: {
    props: recoverableState.extend({ compact: z.boolean().optional() }),
    slots: ['actions'],
    events: [],
    description: 'Accessible recoverable Admin page state.',
  },
  Page: {
    props: z.strictObject({
      width: z.enum(['full', 'content', 'wide']).optional(),
      stack: z.boolean().optional(),
      className: z.string().optional(),
      ariaLabel: z.string().optional(),
    }),
    slots: ['default'],
    events: [],
    description: 'Admin page surface. `stack` spaces several sections (cards, grids, tables) with the standard section gap.',
  },
  PageHeader: {
    props: z.strictObject(header),
    slots: ['actions', 'meta'],
    events: [],
    description: 'Admin page heading and action slots.',
  },
  PageFrame: {
    props: uiComponentDefinitions.Frame.props,
    slots: [
      'default',
      'titleEnd',
      'headerStart',
      'headerEnd',
      'aside',
      'body',
      'summary',
    ],
    events: [],
    description: 'Admin page frame with composition slots.',
  },
  Example: {
    props: z.strictObject({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      className: z.string().optional(),
    }),
    slots: ['default'],
    events: [],
    description: 'A documented example card: the live result of its children, and a Code view that shows them as a native Spec. `id` names the card for in-page links (`#id`) and must be unique on the page. The Code view reads the page Spec, so it appears on pages rendered by LumiSpecPage or under LumiSpecSource.',
  },
  AgentWorkspace: {
    props: z.strictObject({
      endpoint: z.string().optional(),
      resource: z.string().optional(),
      dataProviderName: z.string().optional(),
      body: z.record(z.string(), z.unknown()).optional(),
      param: z.string().optional(),
      placeholder: z.string().optional(),
      emptyTitle: z.string().optional(),
      emptyDescription: z.string().optional(),
      suggestions: uiComponentDefinitions.PromptInput.props.shape.suggestions,
      /** @ references in the composer; `sources` searches one DataProvider resource per tab. */
      mentions: promptMentionsSchema.optional(),
      /** Slash commands; one with a `prompt` fills the composer, others are sent as their label. */
      commands: uiComponentDefinitions.PromptInput.props.shape.commands,
      ariaLabel: z.string().optional(),
    }),
    slots: [],
    events: [],
    description: 'A full-page conversation with an agent endpoint that answers with an AI SDK UI message stream: the conversations, the thread and the composer over one Lumi agent session. The conversations come from the DataProvider `resource` (default `agent-sessions`): its list fills the session list, `getOne` loads a conversation, and it refreshes after each reply. The open conversation is the `param` query parameter (default `session`), so it survives a reload. In the dual layout the conversations take the shell\'s second column in place of the module menu; elsewhere the page shows them in a column of its own. Use it as the page root.',
  },
  ListPage: {
    props: dataTargetSchema
      .extend({
        ...header,
        statePath: z.string().startsWith('/'),
        columns: uiComponentDefinitions.Table.props.shape.columns,
        rowKey: z.string().optional(),
        pageSize: z.number().positive().optional(),
        /** Page, page size and sort in the address query; a string prefixes the parameter names. */
        syncWithLocation: z.union([z.boolean(), z.string()]).optional(),
        filters: queryPropsSchema.shape.filters,
        selectedKeys: z.array(z.union([z.string(), z.number()])).optional(),
        activeRow: z.record(z.string(), z.unknown()).optional(),
        activeAction: z.string().optional(),
        selectable: z.boolean().optional(),
        bulkActions: uiComponentDefinitions.Table.props.shape.bulkActions,
      })
      .strict(),
    slots: ['actions', 'toolbar', 'aside', 'rowActions'],
    events: ['rowClick', 'rowAction', 'selectionChange', 'bulkAction'],
    description:
      'Data-backed Admin list with pagination and sorting in the native page Store. `actions` holds page controls; `toolbar` sits between the header and the results, for a FilterBar whose bound value the `filters` of the list read; `rowActions` works as on Table. With `syncWithLocation` page, page size and sort also live in the address query (`page`, `pageSize`, `sort=field:asc`), so reloads, shared links and back/forward restore them. `bulkActions` show a selection bar over the results; `bulkAction` binds the pressed value to `activeAction` beside the bound `selectedKeys`.',
  },
  FormPage: {
    props: dataTargetSchema
      .extend({
        ...header,
        id: z.union([z.string(), z.number()]).optional(),
        valuesPath: z.string().startsWith('/'),
        initialValues: z.record(z.string(), z.unknown()).optional(),
        rules: z.unknown().optional(),
        saveLabel: z.string().optional(),
        layout: z.enum(['centered', 'publish']).optional(),
      })
      .strict(),
    slots: ['default', 'aside', 'actions'],
    events: ['saved'],
    description:
      'Admin form with business validation, dirty guards and one native value path.',
  },
  // Dashboard widgets. Only serializable props are exposed; formatting
  // callbacks stay in React, so backend-served dashboards use display strings.
  DashboardCard: {
    props: z.strictObject({
      title: z.string(),
      description: z.string().optional(),
      span: z.literal('full').optional(),
      flush: z.boolean().optional(),
    }),
    slots: ['default', 'action', 'footer'],
    events: [],
    description: 'Dashboard panel: one surface with a title, an optional header action and footer line.',
  },
  MetricCard: {
    props: z.strictObject({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      unit: z.string().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
      change: z.string().optional(),
      tone: tone.optional(),
      series: z.array(z.number()).optional(),
      scale: z.enum(['md', 'sm']).optional(),
    }),
    slots: [],
    events: [],
    description: 'A headline figure with unit, change chip and optional sparkline.',
  },
  StatStrip: {
    props: z.strictObject({
      items: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        icon: z.string().optional(),
        value: z.union([z.string(), z.number()]),
        badge: z.string().optional(),
        hint: z.string().optional(),
        change: z.string().optional(),
        series: z.array(z.number()).optional(),
        tone: tone.optional(),
      })),
      ariaLabel: z.string().optional(),
    }),
    slots: [],
    events: [],
    description: 'Totals for the table below, from the same query snapshot as its rows.',
  },
  MatrixChart: {
    props: z.strictObject({
      points: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        display: z.string().optional(),
        note: z.string().optional(),
      })),
      ariaLabel: z.string(),
      rows: z.number().int().positive().optional(),
      max: z.number().optional(),
      labelEvery: z.number().int().positive().optional(),
    }),
    slots: [],
    events: [],
    description: 'Dot-matrix trend for a daily series, with an accessible list of values.',
  },
  BarChart: {
    props: z.strictObject({
      points: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        display: z.string().optional(),
        tone: tone.optional(),
      })),
      ariaLabel: z.string(),
      tone: tone.optional(),
      /** `peak` (default), `none`, or the `key` of the column to emphasise. */
      highlight: z.string().optional(),
      caption: z.string().optional(),
      showValues: z.boolean().optional(),
      axis: z.boolean().optional(),
      max: z.number().positive().optional(),
    }),
    slots: [],
    events: [],
    description: 'Column chart for a handful of categories or days, on dashed gridlines with a value axis and a hover reading. The `highlight` column (the peak by default) is drawn in the full tone and the rest in a tint; `showValues` prints each reading above its column.',
  },
  ProportionList: {
    props: z.strictObject({
      items: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        tone: tone.optional(),
        display: z.string().optional(),
        other: z.boolean().optional(),
      })),
      ariaLabel: z.string(),
      tone: tone.optional(),
      sort: z.enum(['desc', 'none']).optional(),
      showShare: z.boolean().optional(),
      valueTone: z.enum(['default', 'muted']).optional(),
    }),
    slots: [],
    events: [],
    description: 'Ranking of items by value: label, reading and an optional share of the total over a thin bar measured against the largest item. Sorted descending by default; an `other` item stays last in a neutral tone. `valueTone: "muted"` sets the reading back as a secondary count.',
  },
  FunnelChart: {
    props: z.strictObject({
      stages: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        display: z.string().optional(),
      })),
      ariaLabel: z.string(),
      color: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
      scale: z.enum(['sqrt', 'linear']).optional(),
    }),
    slots: [],
    events: [],
    description: 'Centred conversion funnel: ordered stages as tapering bands joined by trapezoid connectors, stepping down one palette colour. Each stage shows its count and share of the first; each connector shows the conversion from the stage above, with the drop-off in the hover reading.',
  },
  RecordList: {
    props: z.strictObject({
      items: z.array(z.strictObject({
        key: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.strictObject({ label: z.string(), tone: tone.optional() }).optional(),
        value: z.string().optional(),
        meta: z.string().optional(),
        checked: z.boolean().optional(),
        progress: z.strictObject({
          value: z.number(),
          max: z.number().optional(),
          tone: z.enum(['default', 'brand', 'success', 'warning', 'danger']).optional(),
        }).optional(),
      })),
      title: z.string().optional(),
      ariaLabel: z.string().optional(),
      loading: z.boolean().optional(),
      emptyLabel: z.string().optional(),
    }),
    slots: [],
    events: [],
    description: 'Compact record rows for a feed, drawer or dashboard side panel: identity, status and a figure, with metadata below. `checked` adds a leading checkbox (a to-do list); `progress` adds a bar under the title. Bind `items` to Query data; use Table for sortable or paginated records.',
  },
  Article: {
    props: z.strictObject({
      title: z.string(),
      /** A standfirst under the title. */
      summary: z.string().optional(),
      author: z.strictObject({
        name: z.string(),
        avatar: z.string().optional(),
        /** Reads after the name, e.g. `Product team`. */
        role: z.string().optional(),
      }).optional(),
      /** Display text for the date, e.g. `Nov 8, 2026`. */
      publishedAt: z.string().optional(),
      /** E.g. `6 min read`. */
      readingTime: z.string().optional(),
      tags: z.array(z.string()).optional(),
      cover: z.strictObject({
        src: z.string(),
        alt: z.string().optional(),
        caption: z.string().optional(),
      }).optional(),
      /** The body: Markdown, or an HTML fragment that is sanitized before it is drawn. */
      content: z.string(),
      /** `markdown` (default) or `html`. */
      format: z.enum(['markdown', 'html']).optional(),
      /** A contents list of the body's h2 and h3 headings beside it on wide screens. Defaults to true. */
      toc: z.boolean().optional(),
      tocTitle: z.string().optional(),
    }),
    slots: ['actions', 'default'],
    events: [],
    description: 'A readable article: tags, title, standfirst, author with date and reading time, an optional cover figure, then the body in the Prose styles from Markdown or sanitized HTML. On wide screens a contents list of the body\'s h2 and h3 headings follows the reading position beside it. `actions` sits beside the byline (edit, share); `default` follows the body, for related records or comments.',
  },
  Pipeline: {
    props: z.strictObject({
      stages: z.array(z.strictObject({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        tone: z.enum(['neutral', 'muted', 'success', 'warning', 'danger', 'info']).optional(),
      })),
      ariaLabel: z.string(),
    }),
    slots: [],
    events: [],
    description: 'Where work piles up across ordered stages: one population split in a single bar, e.g. orders by status. Use FunnelChart when each stage is a subset of the one before.',
  },
  Segmented: {
    props: z.strictObject({
      options: z.array(z.strictObject({ value: z.string(), label: z.string() })),
      value: z.string(),
      ariaLabel: z.string(),
    }),
    slots: [],
    events: ['change'],
    description: 'A small set of exclusive views of the same data; bind value with $bindState.',
  },
  SkuEditor: {
    props: z.strictObject({
      /** `{ attributes: [{ name, values }], variants: [{ key, options, price, stock, sku }] }`; bind with $bindState. */
      value: z.strictObject({
        attributes: z.array(z.strictObject({ name: z.string(), values: z.array(z.string()) })),
        variants: z.array(z.looseObject({
          key: z.string(),
          options: z.record(z.string(), z.string()),
          price: z.number().nullable().optional(),
          stock: z.number().nullable().optional(),
          sku: z.string().optional(),
        })),
      }).optional(),
      /** Field errors such as submitForm's `fieldErrors`; bind with $bindState to clear a cell's message when it is edited. */
      errors: z.record(z.string(), z.string()).optional(),
      /** Error path of the bound value, e.g. `sku`: variant cells read `sku.variants.2.price`. */
      name: z.string().optional(),
      /** Matrix columns; each variant stores its value under `key`. Omitted: `price` (currency, required), `stock` (number, required), `sku` (text). */
      columns: z.array(z.strictObject({
        key: z.string(),
        /** Defaults to the built-in label for `price`, `stock` and `sku`, else the key. */
        label: z.string().optional(),
        kind: z.enum(['number', 'currency', 'text', 'select']),
        required: z.boolean().optional(),
        width: z.union([z.number(), z.string()]).optional(),
        /** Currency columns default to `pricePrefix`. */
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        /** Currency columns default to `precision`. */
        precision: z.number().int().min(0).max(6).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        placeholder: z.string().optional(),
        /** Choices of a `select` column. */
        options: z.array(z.strictObject({ value: z.union([z.string(), z.number()]), label: z.string() })).optional(),
        /** Value of a new combination that inherits nothing for this column. */
        defaultValue: z.union([z.string(), z.number(), z.null()]).optional(),
        /** Header button that copies the first row's value to every row; on by default except for text columns such as codes. */
        fill: z.boolean().optional(),
      })).min(1).optional(),
      /** Wording of this instance, so the matrix can read as models, bundles or plans instead of combinations. `count` and `filled` take `{count}`; `attributeValues` and `removeAttribute` take `{name}`. */
      labels: z.strictObject({
        title: z.string().optional(),
        count: z.string().optional(),
        empty: z.string().optional(),
        /** Tooltip of the header button that applies the first row to all. */
        fill: z.string().optional(),
        /** Announced after a fill, e.g. `Applied to {count} rows`. */
        filled: z.string().optional(),
        attributes: z.string().optional(),
        attributeName: z.string().optional(),
        attributeNamePlaceholder: z.string().optional(),
        valuesPlaceholder: z.string().optional(),
        attributeValues: z.string().optional(),
        addAttribute: z.string().optional(),
        removeAttribute: z.string().optional(),
      }).optional(),
      /** `tooltip` (default) shows a cell's message above it so matrix rows keep one height; `inline` writes it under the control. */
      errorDisplay: z.enum(['inline', 'tooltip']).optional(),
      maxAttributes: z.number().int().min(1).optional(),
      /** Prefix of currency columns, e.g. `¥`. */
      pricePrefix: z.string().optional(),
      /** Decimals of currency columns. */
      precision: z.number().int().min(0).max(6).optional(),
      disabled: z.boolean().optional(),
      readonly: z.boolean().optional(),
      ariaLabel: z.string().optional(),
      className: z.string().optional(),
    }),
    slots: [],
    events: ['change'],
    description: 'Specifications (e.g. Color, Size) as tag inputs, with every combination generated below as a matrix row. `columns` sets what each row edits (number, currency, text or select; default price, stock and code) and `labels` renames the chrome, e.g. to models or bundles. Changing specifications keeps values for combinations that remain; a button beside a column header copies the value of the first row to every row (numeric and select columns by default, `fill` per column).',
  },
  Kanban: {
    props: z.strictObject({
      columns: z.array(z.strictObject({
        value: z.string(),
        title: z.string(),
        limit: z.number().int().nonnegative().optional(),
        collapsed: z.boolean().optional(),
        done: z.boolean().optional(),
      })),
      value: z.array(z.looseObject({
        id: z.union([z.string(), z.number()]),
        title: z.string(),
        description: z.string().optional(),
        tags: z.array(z.strictObject({ label: z.string(), tone: uiComponentDefinitions.Badge.props.shape.tone })).optional(),
        assignee: z.strictObject({ name: z.string(), src: z.string().nullish() }).optional(),
        dueDate: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      })),
      columnField: z.string().optional(),
      rankField: z.string().optional(),
      move: z.strictObject({
        id: z.union([z.string(), z.number()]),
        from: z.string(),
        to: z.string(),
        index: z.number(),
        rank: z.number(),
      }).nullish(),
      activeColumn: z.string().nullish(),
      activeCard: z.union([z.string(), z.number()]).nullish(),
      today: z.string().optional(),
      ariaLabel: z.string().optional(),
      readonly: z.boolean().optional(),
      loading: z.boolean().optional(),
    }),
    slots: [],
    events: ['move', 'add', 'cardClick'],
    description: 'Columns of cards moved by drag and drop or from the keyboard (Space, arrows, Space). Each card names its column in `columnField` (default `status`). On `move` the bound `move` holds `{ id, from, to, index, rank }`; persist `to` and `rank` with `update`. Feed `value` from Query data or bind it with $bindState; `add` writes the column to `activeColumn`, `cardClick` writes the card id to `activeCard`.',
  },
  ScheduleCalendar: {
    props: z.strictObject({
      events: z.array(z.looseObject({
        id: z.union([z.string(), z.number()]),
        title: z.string(),
        start: z.string(),
        end: z.string().optional(),
        allDay: z.boolean().optional(),
        tone: tone.optional(),
      })),
      view: z.enum(['month', 'week']).optional(),
      date: z.string().optional(),
      weekStartsOn: z.number().int().min(0).max(6).optional(),
      locale: z.string().optional(),
      today: z.string().optional(),
      startHour: z.number().int().min(0).max(23).optional(),
      endHour: z.number().int().min(1).max(24).optional(),
      maxEvents: z.number().int().positive().optional(),
      activeDate: z.string().nullish(),
      activeEvent: z.union([z.string(), z.number()]).nullish(),
      ariaLabel: z.string().optional(),
      loading: z.boolean().optional(),
    }),
    slots: [],
    events: ['viewChange', 'dateChange', 'dayClick', 'eventClick'],
    description: 'Month and week calendar of dated events as tone chips; extra events in a month cell fold into a "+N more" menu. Bind `view` and `date` with $bindState to drive a Query for the visible range. `dayClick` writes `YYYY-MM-DD` to `activeDate`; `eventClick` writes the event id to `activeEvent`. Weekday names and the first day of the week follow the locale.',
  },
  TreeFilter: {
    props: z.strictObject({
      items: z.array(treeNodeSchema).optional(),
      source: treeSourceSchema.optional(),
      value: z.union([z.string(), z.number()]).nullish(),
      subtree: z.array(z.union([z.string(), z.number()])).nullish(),
      title: z.string().optional(),
      allLabel: z.string().optional(),
      showAll: z.boolean().optional(),
      searchable: z.boolean().optional(),
      defaultExpandAll: z.boolean().optional(),
      loading: z.boolean().optional(),
      ariaLabel: z.string().optional(),
    }),
    slots: [],
    events: ['change'],
    description: 'Side panel tree that narrows a list to one branch, placed in the ListPage `aside` slot. Bind `value` to the state path a ListPage filter reads (`eq`), or bind `subtree` for the chosen node and its loaded descendants (`in`). `null` means every record. Nodes come from static `items` or a `source` resource.',
  },
  AssistantContext: {
    props: z.strictObject({
      /** Bind it to state, e.g. the table's selected rows mapped to items. */
      items: z.array(agentContextItemSchema).optional(),
    }),
    slots: [],
    events: [],
    description: 'Tells the Shell\'s assistant what this page is about while the page is open: each item becomes a context chip the reader can remove before sending, and leaves when the page closes or the items change. Renders nothing; place it anywhere in the page.',
  },
  Include: {
    props: z.strictObject({
      /** The page to show here, the way a route names its page: a site path, one relative to the manifest, or a name the panel's `pages` endpoint serves. */
      src: z.string().min(1),
      /** Values the included page reads at `/include/params`; bind them, e.g. `{ "id": { "$state": "/route/params/id" } }`. */
      params: z.record(z.string(), z.unknown()).optional(),
    }),
    slots: [],
    events: [],
    description: 'Another JSON page in place of this element, for a block several pages share. It loads when first shown and is cached by src; its state is its own, with params at /include/params, and it starts afresh when params change. A page that includes itself, directly or further down, or includes nested deeper than 8, shows an error.',
  },
  AuditLog: {
    props: z.strictObject({
      resource: z.string().min(1),
      /** One record's history, e.g. `{ "$state": "/route/params/id" }`; the resource's without it. */
      id: z.union([z.string(), z.number()]).optional(),
      pageSize: z.number().int().positive().optional(),
      dataProviderName: z.string().optional(),
      empty: z.string().optional(),
      ariaLabel: z.string().optional(),
    }),
    slots: [],
    events: [],
    description: 'The change history of a resource or one record from the app\'s audit log provider, as an activity feed: who created, updated (with the fields), deleted or imported what, and when. It refreshes after every write to the resource. Place it in a DetailPage or a DashboardCard.',
  },
  RecordPicker: {
    props: dataTargetSchema
      .extend({
        filters: queryPropsSchema.shape.filters,
        columns: uiComponentDefinitions.Table.props.shape.columns,
        rowKey: z.string().optional(),
        labelField: z.string().optional(),
        searchField: z.string().optional(),
        multiple: z.boolean().optional(),
        value: z.union([z.null(), z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
        placeholder: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        pageSize: z.number().int().positive().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
        checks: uiComponentDefinitions.Select.props.shape.checks,
      })
      .strict(),
    slots: [],
    events: ['change'],
    description: 'Form field whose value is one record key (or, with `multiple`, a list of keys) picked from a searchable, paged table in a dialog. Chosen keys show as tags; preselected keys are read by ID so their labels show. `searchField` adds a search box filtering with `like`.',
  },
}
export const adminActionDefinitions = {
  navigate: {
    params: z.strictObject({ to: z.string(), replace: z.boolean().optional() }),
    description: 'Navigate to an explicit Admin URL.',
  },
  openDrawer: {
    params: z.strictObject({
      /** A drawer the host registered in code. */
      name: z.string().min(1).optional(),
      /** A JSON page to show instead, e.g. `/pages/article-edit.json`; it reads `id` and `params` at `/drawer`. */
      src: z.string().min(1).optional(),
      id: z.union([z.string(), z.number()]).optional(),
      /** Values the page reads at `/drawer/params`; they travel in the address, so keep them small. */
      params: z.record(z.string(), z.unknown()).optional(),
      title: z.string().optional(),
      /** `drawer` (default) slides in from the side; `modal` is a centred dialog. */
      mode: z.enum(['drawer', 'modal']).optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
    }).refine(value => Boolean(value.name) !== Boolean(value.src), { message: 'Give either `name` or `src`.' }),
    description: 'Open a drawer or modal with a shareable address: a drawer registered by `name`, or any JSON page by `src`, which reads `id` and `params` at `/drawer`. From inside a drawer it opens on top of it (three layers at most).',
  },
  closeDrawer: {
    params: z.strictObject({}),
    description: 'Close the drawer this element is in (and any above it), through the shared leave guard.',
  },
}
export const adminCatalogDefinitions = {
  components: composeDefinitions(
    lumiComponentDefinitions,
    uiComponentDefinitions,
    adminComponentDefinitions,
    { Chart: chartComponentDefinition },
    {
      // Admin connects the UI upload fields to the Lumi upload service.
      Upload: {
        ...uiComponentDefinitions.Upload,
        props: uiComponentDefinitions.Upload.props.extend({
          upload: uploadRequestSchema.optional(),
        }),
      },
      ImageGrid: {
        ...uiComponentDefinitions.ImageGrid,
        props: uiComponentDefinitions.ImageGrid.props.extend({
          upload: uploadRequestSchema.optional(),
        }),
      },
    },
    {
      // Hierarchical controls may read their nodes from a Lumi `source` resource.
      Tree: { ...uiComponentDefinitions.Tree, props: uiComponentDefinitions.Tree.props.extend({ source: treeSourceSchema.optional() }) },
      TreeSelect: { ...uiComponentDefinitions.TreeSelect, props: uiComponentDefinitions.TreeSelect.props.extend({ source: treeSourceSchema.optional() }) },
      Cascader: { ...uiComponentDefinitions.Cascader, props: uiComponentDefinitions.Cascader.props.extend({ source: treeSourceSchema.optional() }) },
      CascaderPanel: { ...uiComponentDefinitions.CascaderPanel, props: uiComponentDefinitions.CascaderPanel.props.extend({ source: treeSourceSchema.optional() }) },
    },
    {
      // Choice controls may read, search and page their options from a Lumi `source` resource.
      Select: { ...uiComponentDefinitions.Select, props: uiComponentDefinitions.Select.props.extend({ options: uiComponentDefinitions.Select.props.shape.options.optional(), source: optionsSourceSchema.optional() }) },
      MultiSelect: { ...uiComponentDefinitions.MultiSelect, props: uiComponentDefinitions.MultiSelect.props.extend({ options: uiComponentDefinitions.MultiSelect.props.shape.options.optional(), source: optionsSourceSchema.optional() }) },
      AutoComplete: { ...uiComponentDefinitions.AutoComplete, props: uiComponentDefinitions.AutoComplete.props.extend({ source: optionsSourceSchema.optional() }) },
      Mention: { ...uiComponentDefinitions.Mention, props: uiComponentDefinitions.Mention.props.extend({ source: optionsSourceSchema.optional() }) },
      Transfer: { ...uiComponentDefinitions.Transfer, props: uiComponentDefinitions.Transfer.props.extend({ source: optionsSourceSchema.optional() }) },
      // The composer's @ references may search the same resources, one per tab.
      PromptInput: { ...uiComponentDefinitions.PromptInput, props: uiComponentDefinitions.PromptInput.props.extend({ mentions: promptMentionsSchema.optional() }) },
      // The @ picker searches one resource per tab, keyed by the tab's `value`.
      AgentMentionPicker: { ...uiComponentDefinitions.AgentMentionPicker, props: uiComponentDefinitions.AgentMentionPicker.props.extend({ sources: z.record(z.string(), optionsSourceSchema).optional() }) },
    },
    { override: ['Upload', 'ImageGrid', 'Tree', 'TreeSelect', 'Cascader', 'CascaderPanel', 'Select', 'MultiSelect', 'AutoComplete', 'Mention', 'Transfer', 'PromptInput', 'AgentMentionPicker'] },
  ),
  actions: composeDefinitions(lumiActionDefinitions, adminActionDefinitions),
}

// Named here so inferred declarations reference the framework-free UI entry.
export type { FilterOption, TreeNode }
