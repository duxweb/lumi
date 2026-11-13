import type { ReactElement } from 'react'
import type { Locale } from '../i18n'
import { AdminDemo } from '../demo/AdminDemo'

/** The home page's product window around a running Lumi Admin. */
export function Stage({ locale }: { locale: Locale }): ReactElement {
  return (
    <div className="window">
      <div className="window__bar">
        <span className="window__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="window__address">admin.example.com</span>
        <span />
      </div>
      {/* The shell is fixed to its viewport; the transform makes this frame that viewport. */}
      <div className="window__app">
        <AdminDemo locale={locale} />
      </div>
    </div>
  )
}
