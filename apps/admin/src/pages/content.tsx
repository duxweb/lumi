import type { ReactElement } from 'react'
import { useForm, useOne, useTranslate, useUpload } from '@duxweb/lumi'
import { LumiFormPage, LumiFormRow, LumiFormSection } from '@duxweb/lumi-admin'
import { LumiDescriptionList as DescriptionList, LumiFormField as FormField, LumiUpload as Upload } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

interface ArticleDraft {
  title: string
  slug: string
  summary: string
  content: string
  status: string
  visibility: string
  publishAt: string
  category: string
  author: string
  tags: string[]
  featuredImage: string
  featuredAlt: string
  allowComments: boolean
}

const ARTICLE_CATEGORIES = ['Operations', 'Growth', 'Support', 'Finance', 'Security']
const ARTICLE_AUTHORS = ['Ada Admin', 'Mina Manager', 'Sam Support', 'Yuki Lead', 'Theo Ops']
const ARTICLE_TAGS = ['Announcement', 'Guide', 'Internal', 'Priority', 'Runbook', 'Weekly']

const BLANK_ARTICLE: ArticleDraft = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  status: 'draft',
  visibility: 'public',
  publishAt: '2026-08-31',
  category: 'Operations',
  author: ARTICLE_AUTHORS[0]!,
  tags: [],
  featuredImage: '',
  featuredAlt: '',
  allowComments: true,
}

/** A stored article may predate some fields; the draft fills them from the blank one. */
function articleDraft(record: Partial<ArticleDraft> & { tags?: string[] | string }): ArticleDraft {
  const tags = Array.isArray(record.tags) ? record.tags : (record.tags ?? '').split(',').map(tag => tag.trim()).filter(Boolean)
  return { ...BLANK_ARTICLE, ...record, tags, content: record.content ?? record.summary ?? '' }
}

/**
 * The `publish` layout: the body is the work, and everything that decides where
 * it goes lives in a 300px column beside it rather than at the bottom of the
 * form, where it would only be reached after the writing is done.
 */
export function AdminArticleFormRoute(): ReactElement {
  const t = useTranslate()
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useOne<Partial<ArticleDraft>>({ resource: 'articles', id, enabled: Boolean(id) })
  const record = query.data?.data
  const cover = useUpload()
  const form = useForm<ArticleDraft>({
    resource: 'articles',
    id,
    initialValues: id ? (record ? articleDraft(record) : undefined) : BLANK_ARTICLE,
    rules: {
      type: 'object',
      required: ['title', 'summary', 'content'],
      properties: {
        title: { type: 'string', minLength: 4 },
        summary: { type: 'string', minLength: 12 },
        content: { type: 'string', minLength: 20 },
      },
    },
  })
  const error = (name: keyof ArticleDraft): string | undefined => form.errors.find(issue => issue.path === name)?.message
  return (
    <LumiFormPage
      title={id ? t('Edit article') : t('Write article')}
      form={form}
      layout="publish"
      state={id && query.isPending
        ? { kind: 'loading', label: t('Loading article') }
        : id && query.error
          ? { kind: 'error', title: t('Article unavailable'), reason: query.error.message, nextStep: t('Return to Articles or retry this request'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } }
          : undefined}
      saveLabel={id ? t('Save') : t('Publish')}
      savingLabel={id ? t('Saving…') : t('Publishing…')}
      savedLabel={id ? t('Saved') : t('Published')}
      resetLabel={t('Discard')}
      onSaved={() => navigate('/articles')}
      aside={(
        <>
          <LumiFormSection title={t('Publish settings')}>
            <LumiFormRow span="full">
              <FormField name="status" label={t('Status')} fieldType="enum" widget="Select" value={form.values.status} options={[{ label: t('Draft'), value: 'draft' }, { label: t('In review'), value: 'review' }, { label: t('Published'), value: 'published' }]} onChange={value => form.setValue('status', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="publishAt" label={t('Publish date')} fieldType="date" widget="DatePicker" value={form.values.publishAt} onChange={value => form.setValue('publishAt', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="visibility" label={t('Visibility')} fieldType="enum" widget="RadioGroup" direction="row" value={form.values.visibility} options={[{ label: t('Public'), value: 'public' }, { label: t('Private'), value: 'private' }]} onChange={value => form.setValue('visibility', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="allowComments" label={t('Allow comments')} fieldType="boolean" widget="Switch" value={form.values.allowComments} onChange={value => form.setValue('allowComments', value)} />
            </LumiFormRow>
          </LumiFormSection>
          <LumiFormSection title={t('Details')}>
            <LumiFormRow span="full">
              <FormField name="category" label={t('Category')} fieldType="enum" widget="Select" value={form.values.category} options={ARTICLE_CATEGORIES.map(value => ({ label: t(value), value }))} onChange={value => form.setValue('category', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="tags" label={t('Tags')} fieldType="enumMulti" widget="MultiSelect" direction="row" value={form.values.tags} options={ARTICLE_TAGS.map(value => ({ label: t(value), value }))} onChange={value => form.setValue('tags', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="author" label={t('Author')} fieldType="enum" widget="Select" value={form.values.author} options={ARTICLE_AUTHORS.map(value => ({ label: value, value }))} onChange={value => form.setValue('author', value)} />
            </LumiFormRow>
            <LumiFormRow span="full">
              <FormField name="featuredImage" label={t('Featured image')}>
                <Upload
                  ariaLabel={t('Featured image')}
                  accept="image/*"
                  preview
                  value={form.values.featuredImage ? [form.values.featuredImage] : []}
                  loading={cover.uploading}
                  progress={cover.progress}
                  {...(cover.error ? { error: cover.error.message } : {})}
                  onUpload={async files => (await cover.upload(files)).map(file => file.url)}
                  onCancel={cover.cancel}
                  onChange={value => form.setValue('featuredImage', value[0] ?? '')}
                />
              </FormField>
            </LumiFormRow>
            {form.values.featuredImage && (
              <LumiFormRow span="full">
                <FormField name="featuredAlt" label={t('Alternative text')} value={form.values.featuredAlt} placeholder={t('Describe the image for screen readers')} onChange={value => form.setValue('featuredAlt', value)} />
              </LumiFormRow>
            )}
          </LumiFormSection>
        </>
      )}
    >
      <LumiFormSection ariaLabel={t('Article')}>
        <LumiFormRow span="full">
          <FormField name="title" label={t('Title')} required size="lg" value={form.values.title} error={error('title')} placeholder={t('Operations playbook')} onChange={value => form.setValue('title', value)} />
        </LumiFormRow>
        <LumiFormRow span="full">
          <FormField name="slug" ariaLabel={t('Permalink')} size="sm" appearance="filled" prefix="/articles/" value={form.values.slug} placeholder={t('generated-from-the-title')} onChange={value => form.setValue('slug', value)} />
        </LumiFormRow>
        <LumiFormRow span="full">
          <FormField name="summary" label={t('Excerpt')} required fieldType="text" widget="Textarea" rows={3} value={form.values.summary} error={error('summary')} placeholder={t('Two or three sentences shown in article lists and search results')} onChange={value => form.setValue('summary', value)} />
        </LumiFormRow>
        <LumiFormRow span="full">
          <FormField name="content" ariaLabel={t('Content')} required fieldType="text" widget="Textarea" rows={23} value={form.values.content} error={error('content')} placeholder={t('Start writing your article…')} onChange={value => form.setValue('content', value)} />
        </LumiFormRow>
      </LumiFormSection>
    </LumiFormPage>
  )
}

interface ProjectDraft {
  name: string
  code: string
  description: string
  portfolio: string
  priority: string
  status: string
  owner: string
  sponsor: string
  department: string
  progress: number
  budget: number
  currency: string
  costCenter: string
  startAt: string
  dueAt: string
  health: string
  reportingCadence: string
  nextMilestone: string
  riskSummary: string
}

const PROJECT_PORTFOLIOS = ['Commerce', 'Customer experience', 'Operations', 'Platform']
const PROJECT_DEPARTMENTS = ['Engineering', 'Finance', 'Marketing', 'Operations', 'Product']
const PROJECT_PRIORITIES: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
const PROJECT_STATUSES: Record<string, string> = { planned: 'Planned', active: 'Active', review: 'In review', blocked: 'Blocked' }
const PROJECT_HEALTH: Record<string, string> = { onTrack: 'On track', atRisk: 'At risk', offTrack: 'Off track' }

const BLANK_PROJECT: ProjectDraft = {
  name: '',
  code: '',
  description: '',
  portfolio: 'Platform',
  priority: 'medium',
  status: 'planned',
  owner: ARTICLE_AUTHORS[0]!,
  sponsor: ARTICLE_AUTHORS[1]!,
  department: 'Product',
  progress: 0,
  budget: 20000,
  currency: 'USD',
  costCenter: '',
  startAt: '2026-09-01',
  dueAt: '2026-12-18',
  health: 'onTrack',
  reportingCadence: 'weekly',
  nextMilestone: '',
  riskSummary: '',
}

const NON_CODE = /[^A-Z0-9]+/g

/** Seeded projects carry only the list fields; the draft fills the rest. */
function projectDraft(record: Partial<ProjectDraft>): ProjectDraft {
  return { ...BLANK_PROJECT, ...record, code: record.code ?? (record.name ?? '').toUpperCase().replace(NON_CODE, '-').slice(0, 12) }
}

/**
 * The `tabs` layout: parts that do not depend on each other, so the reader may
 * enter at any of them. A step form would imply an order this form does not have.
 */
export function AdminProjectFormRoute(): ReactElement {
  const t = useTranslate()
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useOne<Partial<ProjectDraft>>({ resource: 'projects', id, enabled: Boolean(id) })
  const record = query.data?.data
  const [tab, setTab] = useState('brief')
  const form = useForm<ProjectDraft>({
    resource: 'projects',
    id,
    initialValues: id ? (record ? projectDraft(record) : undefined) : BLANK_PROJECT,
    rules: {
      type: 'object',
      required: ['name', 'code'],
      properties: {
        name: { type: 'string', minLength: 3 },
        code: { type: 'string', minLength: 3 },
        budget: { type: 'number', minimum: 0 },
        progress: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
  })
  const error = (name: keyof ProjectDraft): string | undefined => form.errors.find(issue => issue.path === name)?.message
  const invalidIn = (names: Array<keyof ProjectDraft>): boolean => form.errors.some(issue => names.includes(issue.path as keyof ProjectDraft))
  const choices = (labels: Record<string, string>): Array<{ label: string, value: string }> => Object.entries(labels).map(([value, label]) => ({ label: t(label), value }))
  const chosen = (labels: Record<string, string>, value: string): string => t(labels[value] ?? value)
  // An edited record fills the form only once it has loaded; until then there is nothing to sum up.
  const filled = Object.keys(form.values).length > 0
  return (
    <LumiFormPage
      title={id ? t('Edit project') : t('New project')}
      description={id ? record?.name : t('Plan the scope, people, and delivery of your project')}
      form={form}
      layout="tabs"
      state={id && query.isPending
        ? { kind: 'loading', label: t('Loading project') }
        : id && query.error
          ? { kind: 'error', title: t('Project unavailable'), reason: query.error.message, nextStep: t('Return to Projects or retry this request'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } }
          : undefined}
      onSaved={() => navigate('/projects')}
      aside={filled && (
        <LumiFormSection title={t('Project summary')} description={t('Ownership and delivery at a glance')}>
          <LumiFormRow span="full">
            <DescriptionList items={[
              { label: t('Owner'), value: form.values.owner },
              { label: t('Department'), value: t(form.values.department) },
              { label: t('Priority'), value: chosen(PROJECT_PRIORITIES, form.values.priority) },
              { label: t('Status'), value: chosen(PROJECT_STATUSES, form.values.status) },
              { label: t('Budget'), value: `${form.values.budget.toLocaleString()} ${form.values.currency}` },
              { label: t('Schedule'), value: `${form.values.startAt} – ${form.values.dueAt}` },
              { label: t('Delivery health'), value: chosen(PROJECT_HEALTH, form.values.health) },
            ]}
            />
          </LumiFormRow>
        </LumiFormSection>
      )}
      activeSection={tab}
      onSectionChange={setTab}
      saveLabel={id ? t('Save project') : t('Create project')}
      sections={[
        {
          key: 'brief',
          label: t('Overview'),
          invalid: invalidIn(['name', 'code', 'description', 'portfolio', 'priority', 'owner', 'sponsor', 'department', 'status']),
          content: (
            <>
              <LumiFormSection title={t('Scope')} description={t('Give the project a stable identity and explain the outcome it owns')}>
                <LumiFormRow>
                  <FormField name="name" label={t('Project name')} required value={form.values.name} error={error('name')} placeholder={t('Atlas rollout')} onChange={value => form.setValue('name', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="code" label={t('Project code')} required value={form.values.code} error={error('code')} placeholder={t('ATL-2026')} help={t('Used in reports, tasks, and shared links')} onChange={value => form.setValue('code', value)} />
                </LumiFormRow>
                <LumiFormRow span="full">
                  <FormField name="description" label={t('Objective')} fieldType="text" widget="Textarea" rows={4} value={form.values.description} placeholder={t('Describe the business outcome, audience, and definition of success')} onChange={value => form.setValue('description', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="portfolio" label={t('Portfolio')} fieldType="enum" widget="Select" value={form.values.portfolio} options={PROJECT_PORTFOLIOS.map(value => ({ label: t(value), value }))} onChange={value => form.setValue('portfolio', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="priority" label={t('Priority')} fieldType="enum" widget="Select" value={form.values.priority} options={choices(PROJECT_PRIORITIES)} onChange={value => form.setValue('priority', value)} />
                </LumiFormRow>
              </LumiFormSection>
              <LumiFormSection title={t('Ownership')} description={t('Set the people accountable for decisions and day-to-day delivery')}>
                <LumiFormRow>
                  <FormField name="owner" label={t('Project owner')} fieldType="enum" widget="Select" value={form.values.owner} options={ARTICLE_AUTHORS.map(value => ({ label: value, value }))} onChange={value => form.setValue('owner', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="sponsor" label={t('Executive sponsor')} fieldType="enum" widget="Select" value={form.values.sponsor} options={ARTICLE_AUTHORS.map(value => ({ label: value, value }))} onChange={value => form.setValue('sponsor', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="department" label={t('Owning department')} fieldType="enum" widget="Select" value={form.values.department} options={PROJECT_DEPARTMENTS.map(value => ({ label: t(value), value }))} onChange={value => form.setValue('department', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="status" label={t('Initial status')} fieldType="enum" widget="Select" value={form.values.status} options={choices(PROJECT_STATUSES)} onChange={value => form.setValue('status', value)} />
                </LumiFormRow>
              </LumiFormSection>
            </>
          ),
        },
        {
          key: 'budget',
          label: t('Plan & budget'),
          invalid: invalidIn(['budget', 'currency', 'costCenter', 'startAt', 'dueAt']),
          content: (
            <>
              <LumiFormSection title={t('Financial plan')} description={t('Record the approved envelope and where the project should be charged')}>
                <LumiFormRow>
                  <FormField name="budget" label={t('Approved budget')} fieldType="number" min={0} value={form.values.budget} error={error('budget')} onChange={value => form.setValue('budget', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="currency" label={t('Currency')} fieldType="enum" widget="Select" value={form.values.currency} options={['USD', 'EUR', 'GBP', 'CNY'].map(value => ({ label: value, value }))} onChange={value => form.setValue('currency', value)} />
                </LumiFormRow>
                <LumiFormRow span="full">
                  <FormField name="costCenter" label={t('Cost center')} value={form.values.costCenter} placeholder={t('CC-4200 / Platform delivery')} help={t('Optional. Finance can assign this after approval')} onChange={value => form.setValue('costCenter', value)} />
                </LumiFormRow>
              </LumiFormSection>
              <LumiFormSection title={t('Schedule')} description={t('Define the operating window used by portfolio planning and reminders')}>
                <LumiFormRow>
                  <FormField name="startAt" label={t('Start date')} fieldType="date" widget="DatePicker" value={form.values.startAt} onChange={value => form.setValue('startAt', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="dueAt" label={t('Target completion')} fieldType="date" widget="DatePicker" value={form.values.dueAt} onChange={value => form.setValue('dueAt', value)} />
                </LumiFormRow>
              </LumiFormSection>
            </>
          ),
        },
        {
          key: 'progress',
          label: t('Delivery'),
          invalid: invalidIn(['progress', 'health', 'reportingCadence', 'nextMilestone', 'riskSummary']),
          content: (
            <>
              <LumiFormSection title={t('Reporting')} description={t('Choose how delivery health appears in portfolio reviews')}>
                <LumiFormRow>
                  <FormField name="progress" label={t('Percent complete')} fieldType="number" min={0} max={100} value={form.values.progress} error={error('progress')} help={t('A whole number from 0 to 100')} onChange={value => form.setValue('progress', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="health" label={t('Delivery health')} fieldType="enum" widget="RadioGroup" direction="row" value={form.values.health} options={choices(PROJECT_HEALTH)} onChange={value => form.setValue('health', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="reportingCadence" label={t('Reporting cadence')} fieldType="enum" widget="Select" value={form.values.reportingCadence} options={[{ label: t('Weekly'), value: 'weekly' }, { label: t('Every two weeks'), value: 'biweekly' }, { label: t('Monthly'), value: 'monthly' }]} onChange={value => form.setValue('reportingCadence', value)} />
                </LumiFormRow>
                <LumiFormRow>
                  <FormField name="nextMilestone" label={t('Next milestone')} value={form.values.nextMilestone} placeholder={t('Pilot launch')} onChange={value => form.setValue('nextMilestone', value)} />
                </LumiFormRow>
              </LumiFormSection>
              <LumiFormSection title={t('Risk context')} description={t('Capture what needs attention before the first status review')}>
                <LumiFormRow span="full">
                  <FormField name="riskSummary" label={t('Known risks and dependencies')} fieldType="text" widget="Textarea" rows={5} value={form.values.riskSummary} placeholder={t('List external approvals, team dependencies, or delivery constraints')} onChange={value => form.setValue('riskSummary', value)} />
                </LumiFormRow>
              </LumiFormSection>
            </>
          ),
        },
      ]}
    />
  )
}
