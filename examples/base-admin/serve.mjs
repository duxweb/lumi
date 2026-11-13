// A plain static server: `public/` as the site and the package's prebuilt base
// under `/lumi/`. It exists to prove the base needs no bundler; any web server
// or a Go `http.FileServer` does the same job.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const site = join(here, 'public')
const base = join(here, '../../packages/admin/dist/base')
const port = Number(process.env.PORT ?? 5182)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)
  const [root, rest] = path.startsWith('/lumi/') ? [base, path.slice(5)] : [site, path]
  let file = normalize(join(root, rest))
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory())
    file = join(site, 'index.html') // client-side routes fall back to the shell page
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => process.stdout.write(`Lumi base example on http://127.0.0.1:${port}\n`))
