import type { FrameProps } from '@duxweb/lumi-ui'
import type { ReactElement, ReactNode } from 'react'
import { LumiFrame as Frame } from '@duxweb/lumi-ui'

export interface LumiPageFrameProps extends Omit<FrameProps, 'content'> {
  children?: ReactNode
  /**
   * A band pinned to the top of the panel, above the tool row — for figures
   * that describe the rows below, which must not sit under the controls that
   * change them.
   */
  band?: ReactNode
  tools?: ReactNode
  /**
   * Page-level controls for this frame. They sit on the well beside the title,
   * so they stay in one place no matter how far the panel scrolls.
   */
  actions?: ReactNode
  /**
   * Replaces the title in the well's leading slot — used when a page has tabs
   * or presets, which say the same thing the title would.
   */
  lead?: ReactNode
  /** Rides beside the title, e.g. the record's status. */
  titleEnd?: ReactNode
  /** A panel beside the main one — settings navigation. */
  aside?: ReactNode
  /** Replaces the single panel with the page's own arrangement of surfaces. */
  body?: ReactNode
  /** Lets the tool row and the body reach the inner panel edge, for tables. */
  fill?: boolean
  /** Claims the full measure of a multi-column page grid. */
  span?: 'full'
  className?: string
}

export function LumiPageFrame({ children, band, tools, actions, lead, titleEnd, aside, body, fill, span, className, ...props }: LumiPageFrameProps): ReactElement {
  const panelBody = (
    <>
      {band}
      {tools && <div className="lumi-page-frame__tools">{tools}</div>}
      {children}
    </>
  )
  return (
    <div className={['lumi-page-frame', className].filter(Boolean).join(' ')} data-span={span}>
      <Frame {...props} headerStart={lead} headerEnd={actions} titleEnd={titleEnd} aside={aside} body={body}>
        {fill ? <div data-lumi-fill className="lumi-page-frame__fill">{panelBody}</div> : panelBody}
      </Frame>
    </div>
  )
}
