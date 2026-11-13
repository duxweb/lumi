import type { ReactElement } from 'react'
import { useForm, useOne, useTranslate, useUpload } from '@duxweb/lumi'
import { LumiFormPage, LumiFormRow, LumiFormSection, LumiToggleRow } from '@duxweb/lumi-admin'
import { LumiBadge as Badge, LumiButton as Button, LumiCheckboxGroup as CheckboxGroup, LumiDateTimePicker as DateTimePicker, LumiFormField as FormField, LumiImageGrid as ImageGrid, LumiNumberInput as NumberInput, LumiRichText as RichText, LumiStack as Stack, LumiSwitch as Switch } from '@duxweb/lumi-ui'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { perLocale, statusLabel } from '../shared.js'

interface Product {
  id: number
  name: string
  sku: string
  categoryId: number
  status: 'draft' | 'active' | 'archived'
  updatedAt: string
  subtitle?: string
  brand?: string
  tags?: string[]
  images?: string[]
  listNow?: boolean
  scheduledAt?: string
  channels?: string[]
  shippingTemplate?: string
  freeReturns?: boolean
  shippingInsurance?: boolean
  price?: number
  compareAtPrice?: number | null
  stock?: number
  description?: string
}

interface ProductEditDraft {
  name: string
  subtitle: string
  categoryId: number
  brand: string
  tags: string[]
  images: string[]
  status: Product['status']
  listNow: boolean
  scheduledAt: string
  channels: string[]
  shippingTemplate: string
  freeReturns: boolean
  shippingInsurance: boolean
  price: number
  compareAtPrice: number | null
  stock: number
  sku: string
  description: string
}

const DEFAULT_DESCRIPTION = '## Materials\nDurable woven cotton with a soft, brushed finish.\n\n## Size and care\n180 × 70 cm, about 220 g. Dry clean, or hand wash cold and dry flat.'

const CATEGORY_OPTIONS = perLocale(t => ([
  { label: t('Electronics / Accessories'), value: 1 },
  { label: t('Home / Living'), value: 2 },
  { label: t('Outdoor / Gear'), value: 3 },
]))
const BRAND_OPTIONS = ['Lumi Originals', 'Northwind', 'Contoso'].map(value => ({ label: value, value }))
const SHIPPING_OPTIONS = perLocale(t => ['Free shipping', 'Standard rates', 'Local pickup only'].map(value => ({ label: t(value), value })))
const CHANNEL_OPTIONS = perLocale(t => ([{ label: t('Mini program'), value: 'mini' }, { label: t('Web'), value: 'web' }, { label: t('App'), value: 'app' }]))
const STATUS_TONES = { draft: 'neutral', active: 'success', archived: 'neutral' } as const
// Placeholder photography for records that have no images yet.
const SWATCHES = ['#cfc3b3', '#e2d7b8', '#b8c2cc', '#a9b49e'].map(fill => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${fill}"/></svg>`)}`)
export const MAX_PRODUCT_IMAGES = 9
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const stamp = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * The mock products endpoint stores only identity fields; everything the
 * storefront editor adds starts from demo defaults until the record has them.
 */
function draftFrom(product: Product): ProductEditDraft {
  return {
    name: product.name,
    subtitle: product.subtitle ?? '',
    categoryId: product.categoryId,
    brand: product.brand ?? 'Lumi Originals',
    tags: product.tags ?? ['Bestseller', 'Gift'],
    images: product.images ?? SWATCHES,
    status: product.status,
    listNow: product.listNow ?? true,
    scheduledAt: product.scheduledAt ?? '',
    channels: product.channels ?? ['mini', 'web'],
    shippingTemplate: product.shippingTemplate ?? 'Free shipping',
    freeReturns: product.freeReturns ?? true,
    shippingInsurance: product.shippingInsurance ?? false,
    price: product.price ?? 0,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock ?? 126,
    sku: product.sku,
    description: product.description ?? DEFAULT_DESCRIPTION,
  }
}

/** Images go through the Lumi upload service; the draft keeps only their URLs, cover first. */
export function ProductImages({ value, onChange }: { value: string[], onChange: (next: string[]) => void }): ReactElement {
  const t = useTranslate()
  const upload = useUpload()
  return (
    <ImageGrid
      ariaLabel={t('Product images')}
      max={MAX_PRODUCT_IMAGES}
      maxSize={MAX_IMAGE_BYTES}
      value={value.map(url => ({ url }))}
      onChange={next => onChange(next.map(image => image.url))}
      onUploadFile={async (file, { signal, onProgress }) => (await upload.uploadFile(file, { signal, onProgress })).url}
    />
  )
}

/** Suggestions stay generic: any helper can offer a value the editor accepts or dismisses. */
function SuggestionAction({ onApply, onIgnore }: { onApply: () => void, onIgnore: () => void }): ReactElement {
  const t = useTranslate()
  return (
    <Stack direction="horizontal" gap="sm" wrap>
      <Badge label={t('Suggested')} tone="brand" />
      <Button size="sm" appearance="ghost" label={t('Apply')} onClick={onApply} />
      <Button size="sm" appearance="ghost" label={t('Ignore')} onClick={onIgnore} />
    </Stack>
  )
}

type SuggestedField = 'name' | 'subtitle'

export function AdminProductEditRoute(): ReactElement {
  const t = useTranslate()
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useOne<Product>({ resource: 'products', id })
  const product = query.data?.data
  const form = useForm<ProductEditDraft>({
    resource: 'products',
    id,
    initialValues: product ? draftFrom(product) : undefined,
    rules: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', minLength: 2 } },
    },
  })
  // A helper fills the draft directly; `previous` keeps what each field held
  // before, so Ignore can restore it and Apply simply drops the marker.
  const [previous, setPrevious] = useState<Partial<Record<SuggestedField, string>> | null>(null)
  const loadedName = form.values.name
  useEffect(() => {
    if (!product || previous !== null || loadedName !== product.name)
      return
    setPrevious({ name: product.name, subtitle: product.subtitle ?? '' })
    form.setValue('name', `${product.name} — everyday edition`)
    form.setValue('subtitle', 'Durable, easy to care for, and ready to gift')
  }, [form, loadedName, previous, product])
  const values = form.values
  const fieldError = (name: keyof ProductEditDraft): string | undefined => form.errors.find(issue => issue.path === name)?.message
  const settle = (name: SuggestedField): void => setPrevious(current => ({ ...current, [name]: undefined }))
  const suggestion = (name: SuggestedField): ReactElement | undefined => previous?.[name] !== undefined
    ? (
        <SuggestionAction
          onApply={() => settle(name)}
          onIgnore={() => {
            form.setValue(name, previous[name])
            settle(name)
          }}
        />
      )
    : undefined

  return (
    <LumiFormPage
      title={t('Edit product')}
      description={product ? t('Product {sku} · last saved at {time}', { sku: product.sku, time: stamp.format(new Date(product.updatedAt)) }) : undefined}
      form={form}
      dirtyLabel={t('Unsaved changes')}
      savedLabel={t('Product saved')}
      state={query.isPending
        ? { kind: 'loading', label: t('Loading product') }
        : query.error
          ? { kind: 'error', title: t('Product unavailable'), reason: query.error.message, nextStep: t('Return to Products or retry this request'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } }
          : undefined}
      actions={<Button label={t('Preview')} appearance="outline" icon="eye" onClick={() => navigate(`/products/${id}`)} />}
      renderActions={({ save, saving }) => (
        <>
          <Button
            label={t('Save draft')}
            appearance="outline"
            disabled={saving}
            onClick={() => {
              form.setValue('status', 'draft')
              void save()
            }}
          />
          <Button
            label={t('Publish')}
            loading={saving}
            disabled={saving}
            onClick={() => {
              form.setValue('status', 'active')
              void save()
            }}
          />
        </>
      )}
      aside={(
        <>
          <LumiFormSection title={t('Publish')} variant="rows">
            <LumiToggleRow title={t('Status')}>
              <Badge dot label={t(statusLabel(values.status ?? 'draft'))} tone={STATUS_TONES[values.status ?? 'draft']} />
            </LumiToggleRow>
            <LumiToggleRow title={t('List now')} controlId="product-list-now">
              <Switch id="product-list-now" name="listNow" ariaLabel={t('List now')} value={values.listNow ?? false} onChange={value => form.setValue('listNow', value)} />
            </LumiToggleRow>
            <FormField name="scheduledAt" label={t('Scheduled listing')} help={values.listNow ? t('Listed as soon as you publish') : undefined}>
              <DateTimePicker id="product-scheduled-at" ariaLabel={t('Scheduled listing')} disabled={values.listNow} value={values.scheduledAt ?? ''} onChange={value => form.setValue('scheduledAt', value ?? '')} />
            </FormField>
            <FormField name="channels" label={t('Sales channels')}>
              <CheckboxGroup ariaLabel={t('Sales channels')} direction="row" options={CHANNEL_OPTIONS(t)} value={values.channels ?? []} onChange={value => form.setValue('channels', value)} />
            </FormField>
          </LumiFormSection>
          <LumiFormSection title={t('Shipping & after-sales')} variant="rows">
            <FormField name="shippingTemplate" label={t('Shipping template')} fieldType="enum" widget="Select" options={SHIPPING_OPTIONS(t)} value={values.shippingTemplate} onChange={value => form.setValue('shippingTemplate', value)} />
            <LumiToggleRow title={t('30-day free returns')} controlId="product-free-returns">
              <Switch id="product-free-returns" name="freeReturns" ariaLabel={t('30-day free returns')} value={values.freeReturns ?? false} onChange={value => form.setValue('freeReturns', value)} />
            </LumiToggleRow>
            <LumiToggleRow title={t('Shipping insurance')} controlId="product-insurance">
              <Switch id="product-insurance" name="shippingInsurance" ariaLabel={t('Shipping insurance')} value={values.shippingInsurance ?? false} onChange={value => form.setValue('shippingInsurance', value)} />
            </LumiToggleRow>
          </LumiFormSection>
        </>
      )}
    >
      <LumiFormSection title={t('Basic info')} description={t('The name and subtitle appear in search results and share cards')}>
        <LumiFormRow span="full" action={suggestion('name')}>
          <FormField name="name" label={t('Product name')} required value={values.name ?? ''} error={fieldError('name')} onChange={value => form.setValue('name', value)} />
        </LumiFormRow>
        <LumiFormRow span="full" action={suggestion('subtitle')}>
          <FormField name="subtitle" label={t('Subtitle')} value={values.subtitle ?? ''} onChange={value => form.setValue('subtitle', value)} />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="categoryId" label={t('Category')} fieldType="enum" widget="Select" options={CATEGORY_OPTIONS(t)} value={values.categoryId} onChange={value => form.setValue('categoryId', value)} />
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="brand" label={t('Brand')} fieldType="enum" widget="Select" options={BRAND_OPTIONS} value={values.brand} onChange={value => form.setValue('brand', value)} />
        </LumiFormRow>
        <LumiFormRow span="full">
          <FormField name="tags" label={t('Tags')} widget="TagsInput" placeholder={t('Type and press Enter')} value={values.tags ?? []} onChange={value => form.setValue('tags', value as string[])} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Images')} description={t('The first image is the cover. Use 800 × 800 or larger, up to {count} images', { count: MAX_PRODUCT_IMAGES })}>
        <LumiFormRow span="full">
          <ProductImages value={values.images ?? []} onChange={value => form.setValue('images', value)} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Price & stock')}>
        <LumiFormRow>
          <FormField name="price" label={t('Price')}>
            <NumberInput id="product-price" ariaLabel={t('Price')} min={0} precision={2} prefix="$" value={values.price ?? 0} onChange={value => form.setValue('price', value ?? 0)} />
          </FormField>
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="compareAtPrice" label={t('Compare-at price')} help={t('Leave blank to hide')}>
            <NumberInput id="product-compare-at-price" ariaLabel={t('Compare-at price')} min={0} precision={2} prefix="$" value={values.compareAtPrice ?? null} onChange={value => form.setValue('compareAtPrice', value)} />
          </FormField>
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="stock" label={t('Stock')} help={t('Across all warehouses')}>
            <NumberInput id="product-stock" ariaLabel={t('Stock')} min={0} precision={0} suffix="units" value={values.stock ?? 0} onChange={value => form.setValue('stock', value ?? 0)} />
          </FormField>
        </LumiFormRow>
        <LumiFormRow>
          <FormField name="sku" label={t('SKU')} value={values.sku ?? ''} onChange={value => form.setValue('sku', value)} />
        </LumiFormRow>
      </LumiFormSection>
      <LumiFormSection title={t('Details')}>
        <LumiFormRow span="full">
          <FormField name="description" label={t('Description')}>
            <RichText id="product-description" ariaLabel={t('Description')} rows={8} value={values.description ?? ''} onChange={value => form.setValue('description', value)} />
          </FormField>
        </LumiFormRow>
      </LumiFormSection>
    </LumiFormPage>
  )
}
