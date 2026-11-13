import type { FilterModel, ListFilterSchema } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useFormatDate, useTable, useTranslate } from '@duxweb/lumi'
import { LumiCardList, LumiListPage, LumiRecordCard } from '@duxweb/lumi-admin'
import { LumiBadge as Badge } from '@duxweb/lumi-ui'
import { filterConditionsToCoreFilters, filterModelToConditions } from '@duxweb/lumi-ui/catalog'
import { useMemo, useState } from 'react'
import { currency, perLocale } from '../shared.js'

interface Project {
  id: number
  name: string
  description: string
  status: 'active' | 'review' | 'blocked' | 'planned'
  owner: string
  progress: number
  budget: number
  dueAt: string
}

interface Article {
  id: number
  title: string
  summary: string
  category: string
  author: string
  updatedAt: string
}

const PROJECT_STATUS = perLocale(t => ({
  active: { label: t('Active'), tone: 'success' },
  review: { label: t('In review'), tone: 'info' },
  blocked: { label: t('Blocked'), tone: 'danger' },
  planned: { label: t('Planned'), tone: 'neutral' },
} as const))

const DATE_LABEL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }

const projectFilterSchema = perLocale((t): ListFilterSchema => ({
  fields: [
    { field: 'name', label: t('Search projects'), widget: 'search', placeholder: t('Search project…'), primary: true },
    { field: 'status', label: t('Status'), widget: 'chips', options: Object.entries(PROJECT_STATUS(t)).map(([value, item]) => ({ label: item.label, value })) },
  ],
}))

const articleFilterSchema = perLocale((t): ListFilterSchema => ({
  fields: [
    { field: 'title', label: t('Search articles'), widget: 'search', placeholder: t('Search title or summary…'), primary: true },
    { field: 'category', label: t('Category'), widget: 'select', options: ['Operations', 'Growth', 'Support', 'Finance', 'Security'].map(value => ({ label: t(value), value })), placeholder: t('Category'), primary: true },
    { field: 'author', label: t('Author'), widget: 'select', options: ['Ada Admin', 'Mina Manager', 'Sam Support', 'Yuki Lead', 'Theo Ops'].map(value => ({ label: value, value })), placeholder: t('Author'), primary: true },
  ],
}))

/**
 * Card list: the same list chrome as a table page, but each record is an object
 * you scan as a card — not a row you compare column by column.
 */
export function AdminProjectCardsRoute(): ReactElement {
  const t = useTranslate()
  const formatDate = useFormatDate()
  const [filters, setFilters] = useState<FilterModel>({})
  const coreFilters = useMemo(() => filterConditionsToCoreFilters(filterModelToConditions(projectFilterSchema(t).fields, filters)), [filters])
  // Twelve fills every row of the two-, three- and four-column grids.
  const table = useTable<Project>({ resource: 'projects', pagination: { pageSize: 12 }, filters: coreFilters })
  return (
    <LumiListPage
      title={t('Project cards')}
      description={t('Track ownership, budgets, and delivery across your portfolio')}
      columnsMenu={false}
      filters={{
        title: t('Project filters'),
        schema: projectFilterSchema(t),
        applyMode: 'immediate',
        value: filters,
        loading: table.query.isFetching,
        onChange: (value) => {
          setFilters(value)
          table.setPage(1)
        },
      }}
      results={(
        <LumiCardList
          items={table.rows}
          getKey={project => project.id}
          ariaLabel={t('Projects')}
          state={table.query.isPending
            ? { kind: 'loading', label: t('Loading projects') }
            : table.query.error
              ? { kind: 'error', title: t('Projects unavailable'), reason: t('The project list could not be loaded'), nextStep: t('Retry the request'), actionLabel: t('Retry'), onAction: () => { void table.query.refetch() } }
              : undefined}
          empty={{ title: t('No projects found'), reason: t('No projects match these filters'), nextStep: t('Clear the filters to see your portfolio'), actionLabel: t('Clear filters'), onAction: () => {
            setFilters({})
            table.setPage(1)
          } }}
          renderItem={(project) => {
            const status = PROJECT_STATUS(t)[project.status]
            return (
              <LumiRecordCard
                href={`/projects/${project.id}/edit`}
                title={project.name}
                description={project.description}
                meta={<Badge label={status.label} tone={status.tone} appearance="soft" />}
                fields={[
                  { key: 'owner', label: t('Owner'), value: project.owner },
                  { key: 'budget', label: t('Budget'), value: currency.format(project.budget) },
                ]}
                progress={{ label: t('Delivery progress'), value: project.progress }}
                footer={(
                  <>
                    <span>{t('Due date')}</span>
                    <time dateTime={project.dueAt}>{formatDate(project.dueAt, DATE_LABEL)}</time>
                  </>
                )}
              />
            )
          }}
        />
      )}
      pager={{
        page: table.page,
        pageSize: table.pageSize,
        total: table.total,
        loading: table.query.isPending,
        pageSizeOptions: [12, 24, 48],
        onPageChange: table.setPage,
        onPageSizeChange: (pageSize) => {
          table.setPageSize(pageSize)
          table.setPage(1)
        },
      }}
    />
  )
}

/**
 * Search list: conditions stay on top and the hits are stacked cards you read,
 * not a table you sort. Authoring and retrieval are different jobs.
 */
export function AdminArticleSearchRoute(): ReactElement {
  const t = useTranslate()
  const formatDate = useFormatDate()
  const [filters, setFilters] = useState<FilterModel>({})
  const coreFilters = useMemo(() => filterConditionsToCoreFilters(filterModelToConditions(articleFilterSchema(t).fields, filters)), [filters])
  const table = useTable<Article>({ resource: 'articles', pagination: { pageSize: 6 }, filters: coreFilters })
  return (
    <LumiListPage
      title={t('Search articles')}
      description={t('Find published knowledge by title, category, or author')}
      columnsMenu={false}
      filters={{
        title: t('Article search'),
        schema: articleFilterSchema(t),
        applyMode: 'immediate',
        value: filters,
        loading: table.query.isFetching,
        onChange: (value) => {
          setFilters(value)
          table.setPage(1)
        },
      }}
      results={(
        <LumiCardList
          items={table.rows}
          getKey={article => article.id}
          layout="list"
          ariaLabel={t('Articles')}
          state={table.query.isPending
            ? { kind: 'loading', label: t('Searching articles') }
            : table.query.error
              ? { kind: 'error', title: t('Articles unavailable'), reason: t('The article list could not be loaded'), nextStep: t('Retry the request'), actionLabel: t('Retry'), onAction: () => { void table.query.refetch() } }
              : undefined}
          empty={{ title: t('No articles found'), reason: t('No articles match these filters'), nextStep: t('Try a different title or clear the filters'), actionLabel: t('Clear filters'), onAction: () => {
            setFilters({})
            table.setPage(1)
          } }}
          renderItem={article => (
            <LumiRecordCard
              href={`/articles/${article.id}/edit`}
              title={article.title}
              description={article.summary}
              meta={<Badge label={t(article.category)} appearance="soft" />}
              footer={(
                <>
                  <span>{article.author}</span>
                  <time dateTime={article.updatedAt}>{formatDate(article.updatedAt, DATE_LABEL)}</time>
                </>
              )}
            />
          )}
        />
      )}
      pager={{
        page: table.page,
        pageSize: table.pageSize,
        total: table.total,
        loading: table.query.isPending,
        pageSizeOptions: [6, 12, 24],
        onPageChange: table.setPage,
        onPageSizeChange: (pageSize) => {
          table.setPageSize(pageSize)
          table.setPage(1)
        },
      }}
    />
  )
}
