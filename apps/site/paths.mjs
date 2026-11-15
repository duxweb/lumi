const EDGE_SLASHES_RE = /^\/+|\/+$/gu

/** @param {string} [value] */
export function normalizeBase(value = '/') {
  const path = value.replace(EDGE_SLASHES_RE, '')
  return path ? `/${path}/` : '/'
}

/** @param {string} path @param {string} base */
export function withBase(path, base) {
  return path.startsWith('/') && !path.startsWith('//')
    ? `${normalizeBase(base).slice(0, -1)}${path}`
    : path
}
