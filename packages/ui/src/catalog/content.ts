import { z } from 'zod'

const host = {
  'className': z.string().optional(),
  'data-testid': z.string().optional(),
  'aria-label': z.string().optional(),
}

/** Body size of long-form text: `sm` for side panels, `md` (default) for pages, `lg` for reading views. */
const proseSize = z.enum(['sm', 'md', 'lg']).optional()

export const contentDefinitions = {
  Prose: {
    props: z
      .strictObject({
        size: proseSize,
      })
      .extend(host),
    slots: ['default'],
    events: [],
    description: 'Typesets long-form content: headings, paragraphs, lists, quotes, code, tables, images and rules share one reading rhythm. Wrap Heading and Text children in it, or use Markdown and Html, which render inside the same styles. `size` sets the body size; the width follows the container.',
  },
  Markdown: {
    props: z
      .strictObject({
        /** Markdown source: headings, lists, task items, quotes, fenced code, tables, links and images. */
        content: z.string(),
        size: proseSize,
        /** Gives headings ids from their text, for in-page links. Defaults to true. */
        anchors: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'Renders Markdown as typeset content in the Prose styles: headings, paragraphs, ordered, unordered and task lists, quotes, fenced code with highlighting, tables, rules, links, emphasis and images (`![alt](src "caption")`; alone on a line it becomes a captioned figure). Raw HTML in the source stays text, and only http(s), mailto, tel and relative links or http(s) and relative images are drawn. Headings get ids from their text unless `anchors` is false.',
  },
  Html: {
    props: z
      .strictObject({
        /** HTML from a trusted editor or backend; it is sanitized before it is drawn. */
        content: z.string(),
        size: proseSize,
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'Renders an HTML fragment, such as an article body saved by a rich-text editor, as typeset content in the Prose styles. The markup is sanitized first: scripts, event handlers, inline styles, forms, frames and unsafe URLs are removed, ids are prefixed so they cannot clash with the page, and external links open in a new tab without access to the opener. The sanitizer loads on first use; until then the block is empty.',
  },
}
