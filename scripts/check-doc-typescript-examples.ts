#!/usr/bin/env tsx
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const docs = join(root, 'apps/site')
const temporary = join(docs, '.typecheck-examples')
async function walk(dir: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(entry =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      ),
    )
  ).flat()
}
await mkdir(temporary, { recursive: true })
try {
  const files: string[] = []
  for (const file of await walk(join(docs, 'src/content/docs'))) {
    for (const [index, match] of [
      ...(await readFile(file, 'utf8')).matchAll(
        /```(tsx?)\n([\s\S]*?)\n```/gu,
      ),
    ].entries()) {
      const name = join(
        temporary,
        `${relative(docs, file).replaceAll('/', '_')}-${index}.${match[1]}`,
      )
      await writeFile(name, `${match[2]!}\nexport {}\n`)
      files.push(name)
    }
  }
  if (!files.length)
    throw new Error('No TypeScript examples checked')
  const config = ts.readConfigFile(
    join(root, 'config/tsconfig.base.json'),
    ts.sys.readFile,
  )
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    join(root, 'config'),
  )
  const program = ts.createProgram(files, {
    ...parsed.options,
    jsx: ts.JsxEmit.ReactJSX,
    noEmit: true,
    types: ['react', 'vite/client'],
    baseUrl: root,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: f => f,
        getNewLine: () => '\n',
      }),
    )
  }
  console.log(`Typechecked ${files.length} documentation examples`)
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
