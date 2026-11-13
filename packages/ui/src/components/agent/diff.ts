export interface DiffLine {
  kind: 'same' | 'added' | 'removed'
  text: string
  /** 0-based line in `before`, for unchanged and removed lines. */
  before?: number
  /** 0-based line in `after`, for unchanged and added lines. */
  after?: number
}

export type DiffRow = DiffLine | { kind: 'gap', count: number, from: number }

// Beyond this many cells the quadratic table costs more than the answer is
// worth; the changed middle then shows as removed-then-added.
const MAX_CELLS = 4_000_000

/** A line diff by longest common subsequence, with the common head and tail trimmed first. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start])
    start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const lines: DiffLine[] = []
  for (let index = 0; index < start; index++)
    lines.push({ kind: 'same', text: a[index]!, before: index, after: index })
  const n = endA - start
  const m = endB - start
  if (n * m > MAX_CELLS) {
    for (let index = start; index < endA; index++)
      lines.push({ kind: 'removed', text: a[index]!, before: index })
    for (let index = start; index < endB; index++)
      lines.push({ kind: 'added', text: b[index]!, after: index })
  }
  else {
    const width = m + 1
    const table = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = a[start + i] === b[start + j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        lines.push({ kind: 'same', text: a[start + i]!, before: start + i, after: start + j })
        i++
        j++
      }
      else if (j >= m || (i < n && table[(i + 1) * width + j]! >= table[i * width + j + 1]!)) {
        lines.push({ kind: 'removed', text: a[start + i]!, before: start + i })
        i++
      }
      else {
        lines.push({ kind: 'added', text: b[start + j]!, after: start + j })
        j++
      }
    }
  }
  for (let index = 0; index < a.length - endA; index++)
    lines.push({ kind: 'same', text: a[endA + index]!, before: endA + index, after: endB + index })
  return lines
}

/** Folds unchanged runs longer than twice `context` into gaps, keeping `context` lines around each change. */
export function collapseDiff(lines: DiffLine[], context = 3): DiffRow[] {
  const keep = lines.map(line => line.kind !== 'same')
  const near = keep.map((_, index) => {
    for (let offset = -context; offset <= context; offset++) {
      if (keep[index + offset])
        return true
    }
    return false
  })
  const rows: DiffRow[] = []
  let gap = 0
  // A fold must hide more than the line it costs to show it.
  const close = (end: number): void => {
    if (gap > 2)
      rows.push({ kind: 'gap', count: gap, from: end - gap })
    else
      rows.push(...lines.slice(end - gap, end))
    gap = 0
  }
  lines.forEach((line, index) => {
    if (near[index]) {
      close(index)
      rows.push(line)
    }
    else {
      gap++
    }
  })
  close(lines.length)
  return rows
}
