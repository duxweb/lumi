import type { TableColumn } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { useEffect, useRef } from 'react'

export interface LumiColumnsMenuProps {
  columns: readonly TableColumn[]
  /** Fields currently shown. Everything outside this list is hidden. */
  value: readonly string[]
  onChange: (visible: string[]) => void
  label?: string
  className?: string
}

/**
 * Column visibility, named rather than drawn as a bare icon: three stacked bars
 * read as "menu" or "sort" just as readily as "columns".
 */
export function LumiColumnsMenu(props: LumiColumnsMenuProps): ReactElement {
  const { t } = useUiText()
  const { columns, value, onChange, label = t('lumi.list.columns', 'Columns'), className } = props
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.removeAttribute('open')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])
  const toggle = (field: string, shown: boolean): void => {
    const next = columns
      .map(column => column.field)
      .filter(candidate => candidate === field ? !shown : value.includes(candidate))
    onChange(next)
  }
  return (
    <details
      ref={menu}
      className={['lumi-columns-menu', className].filter(Boolean).join(' ')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape')
          return
        event.preventDefault()
        menu.current?.removeAttribute('open')
      }}
    >
      <summary className="lumi-columns-menu__trigger" data-testid="admin-columns-menu" aria-haspopup="menu">
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <rect x="3" y="4" width="6" height="16" rx="1" />
          <rect x="11" y="4" width="4" height="16" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </svg>
        {label}
      </summary>
      <div className="lumi-columns-menu__panel lumi-glass-panel" role="menu" aria-label={label}>
        {columns.map((column) => {
          const shown = value.includes(column.field)
          // The last visible column cannot be hidden: an empty table is not a view.
          const locked = shown && value.length === 1
          return (
            <button
              key={column.field}
              type="button"
              role="menuitemcheckbox"
              aria-checked={shown}
              disabled={locked}
              className="lumi-columns-menu__item"
              onClick={() => toggle(column.field, shown)}
            >
              <span className="lumi-columns-menu__mark" aria-hidden>
                {shown && <svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              {column.label ?? column.field}
            </button>
          )
        })}
      </div>
    </details>
  )
}
