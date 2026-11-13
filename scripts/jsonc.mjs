/**
 * Removes `//` and block comments from JSON with comments (JSONC), leaving
 * strings untouched, so a documented example parses as the plain JSON a page
 * file holds. Trailing commas are not accepted: JSON files have none.
 */
export function stripJsonComments(source) {
  let output = ''
  let inString = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]
    if (inString) {
      output += char
      if (char === '\\') {
        output += next ?? ''
        index++
      }
      else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      continue
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n')
        index++
      output += '\n'
      continue
    }
    if (char === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/'))
        index++
      index++
      continue
    }
    output += char
  }
  return output
}
