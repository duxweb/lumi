import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readPackedTarballs } from '../../../scripts/packed-tarballs.mjs'

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))
const packageDirectories = new Map([
  ['@duxweb/lumi', join(workspaceRoot, 'packages/lumi')],
  ['@duxweb/lumi-ui', join(workspaceRoot, 'packages/ui')],
  ['@duxweb/create-lumi', join(workspaceRoot, 'packages/create')],
])
const packageNames = [...packageDirectories.keys()]
const templateDependencies = Object.keys(
  JSON.parse(
    readFileSync(
      join(workspaceRoot, 'packages/create/templates/react/package.json'),
      'utf8',
    ),
  ).dependencies,
)

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code =>
      code === 0
        ? resolvePromise()
        : reject(
            new Error(`${command} ${args.join(' ')} exited with code ${code}`),
          ))
  })
}

function isWithin(root, target) {
  const path = relative(root, target)
  return (
    path === ''
    || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
  )
}

// Copies the tarballs packed once by scripts/pack-packages.mjs into the isolated
// root, so the smoke never rebuilds or repacks and file: specifiers stay inside it.
async function packPackages(tarballRoot) {
  const packed = readPackedTarballs()
  const tarballs = new Map()
  for (const name of packageNames) {
    const target = join(tarballRoot, basename(packed.get(name)))
    await copyFile(packed.get(name), target)
    tarballs.set(name, target)
  }
  return tarballs
}

async function readManifest(root) {
  return JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
}

function assertTemplateManifest(manifest, version) {
  const versions = Object.values({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
  assert(
    !versions.some(
      value => value === 'latest' || value.startsWith('workspace:'),
    ),
  )
  for (const name of templateDependencies) {
    assert(
      name in manifest.dependencies,
      `Missing direct dependency required by published peers: ${name}`,
    )
  }
  for (const name of packageNames.filter(
    name => name !== '@duxweb/create-lumi',
  ))
    assert.equal(manifest.dependencies[name], version)
}

async function scaffold(runnerRoot, name, packageManager) {
  await run(
    'pnpm',
    [
      'exec',
      'create-lumi',
      name,
      '--pm',
      packageManager,
      '--no-install',
      '--no-git',
    ],
    runnerRoot,
  )
  return join(runnerRoot, name)
}

async function assertSymlinksStayWithin(root, current) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) {
      const target = await realpath(path)
      assert(
        isWithin(root, target),
        `Symlink escapes the isolated root: ${path} -> ${target}`,
      )
    }
    else if (stat.isDirectory()) {
      await assertSymlinksStayWithin(root, path)
    }
  }
}

async function assertTextDoesNotReferenceWorkspace(projectRoot) {
  const pending = [projectRoot]
  const extensions = new Set([
    '.css',
    '.html',
    '.js',
    '.json',
    '.mjs',
    '.ts',
    '.tsx',
  ])
  while (pending.length > 0) {
    const current = pending.pop()
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules')
        continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
        continue
      }
      if (!extensions.has(entry.name.slice(entry.name.lastIndexOf('.'))))
        continue
      const source = await readFile(path, 'utf8')
      assert(
        !source.includes(workspaceRoot),
        `Generated source or output references the workspace: ${path}`,
      )
    }
  }
}

async function assertPackageResolution(root, names) {
  const script = join(root, 'verify-resolution.mjs')
  await writeFile(
    script,
    `
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { isAbsolute, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = realpathSync(${JSON.stringify(root)})
for (const name of ${JSON.stringify(names)}) {
  const target = realpathSync(fileURLToPath(import.meta.resolve(name)))
  const path = relative(root, target)
  assert(path === '' || (!path.startsWith('..' + sep) && path !== '..' && !isAbsolute(path)), name + ' resolved outside ' + root + ': ' + target)
}
`,
  )
  await run('node', [script], root)
  await rm(script)
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'lumi-create-isolated-'))
  const isolatedRoot = await realpath(temporaryRoot)
  assert(
    !isWithin(workspaceRoot, isolatedRoot),
    `Smoke root must be outside the workspace: ${isolatedRoot}`,
  )

  try {
    const tarballRoot = join(isolatedRoot, 'tarballs')
    const runnerRoot = join(isolatedRoot, 'runner')
    await mkdir(tarballRoot)
    await mkdir(runnerRoot)
    const tarballs = await packPackages(tarballRoot)
    const createPackage = await readManifest(
      packageDirectories.get('@duxweb/create-lumi'),
    )

    await writeFile(
      join(runnerRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'create-lumi-smoke-runner',
          private: true,
          dependencies: {
            '@duxweb/create-lumi': `file:${relative(runnerRoot, tarballs.get('@duxweb/create-lumi'))}`,
          },
        },
        null,
        2,
      ),
    )
    await run(
      'pnpm',
      ['install', '--ignore-workspace', '--strict-peer-dependencies'],
      runnerRoot,
    )
    await assertPackageResolution(runnerRoot, ['@duxweb/create-lumi'])

    const projectRoot = await scaffold(runnerRoot, 'pnpm-app', 'pnpm')
    const yarnRoot = await scaffold(runnerRoot, 'yarn-app', 'yarn')
    const projectManifest = await readManifest(projectRoot)
    const yarnManifest = await readManifest(yarnRoot)
    assertTemplateManifest(projectManifest, createPackage.version)
    assertTemplateManifest(yarnManifest, createPackage.version)

    for (const name of packageNames.filter(
      name => name !== '@duxweb/create-lumi',
    )) {
      projectManifest.dependencies[name]
        = `file:${relative(projectRoot, tarballs.get(name))}`
    }
    await writeFile(
      join(projectRoot, 'package.json'),
      `${JSON.stringify(projectManifest, null, 2)}\n`,
    )

    await run(
      'pnpm',
      ['install', '--ignore-workspace', '--strict-peer-dependencies'],
      projectRoot,
    )
    await assertPackageResolution(projectRoot, templateDependencies)
    await run('pnpm', ['run', 'typecheck'], projectRoot)
    await run('pnpm', ['run', 'build'], projectRoot)

    const outputRoot = await realpath(join(projectRoot, 'dist'))
    assert(
      isWithin(isolatedRoot, outputRoot),
      `Build output escapes the isolated root: ${outputRoot}`,
    )
    await assertSymlinksStayWithin(isolatedRoot, runnerRoot)
    await assertTextDoesNotReferenceWorkspace(projectRoot)
    process.stdout.write(
      `Isolated create-lumi smoke passed in ${isolatedRoot}\n`,
    )
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
