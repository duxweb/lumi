import { useUiText } from '../../components/text.js'
import { Loader2Icon } from '../../icons.js'
import { cn } from '../utils.js'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>): React.ReactElement | null {
  const { t } = useUiText()
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={t('lumi.spinner.loading', 'Loading')} className={cn('size-4 animate-spin', className)} {...props} />
  )
}

export { Spinner }
