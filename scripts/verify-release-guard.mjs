// Enforces the release shape: publishing happens only through the Changesets
// action calling `pnpm run release` (= `changeset publish`), in a job that
// `needs:` the shared CI workflow. Its parallel jobs cover verify:ci and every
// full E2E project; publishing builds packages but never repeats verification.
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const releaseCommand = 'changeset publish'
const directPublishPattern = /\b(?:(?:pnpm|yarn)\s+(?:exec\s+)?|(?:npx|bunx)\s+)?(?:changeset|@changesets\/cli)\s+publish\b|\b(?:npm|pnpm|yarn)\s+publish\b/u
const verificationPattern = /\bpnpm\s+(?:run\s+)?verify:(?:ci|release)(?![\w:-])/u
// The whole suite: `pnpm e2e` alone runs only the smoke tests.
const e2ePattern = /\bpnpm\s+(?:run\s+)?e2e:full\b/u
const workflowFilePattern = /\.ya?ml$/u
const jobsHeader = /^jobs:\s*$/u
const topLevelLine = /^\S/u
const jobHeader = /^ {2}([\w-]+):\s*$/u
const needsLine = /^ {4}needs:[ \t]*(\S.*)$/u
const listBrackets = /[[\]]/gu
const runLine = /^\s*(?:-\s+)?run:[ \t]*(\S.*)$/u
const publishLine = /^\s*publish:[ \t]*(\S.*)$/u
const releaseRun = /\bpnpm\s+(?:run\s+)?release\b/u
const publishKey = /^\s*publish:/u
const buildPackagesRun = /run:\s*pnpm\s+(?:run\s+)?build:packages\b/u
const releasePublishValue = /^\s*publish: pnpm run release$/mu
const workflowUses = /^ {4}uses: (.+)$/mu
const optionalExecution = /^\s*(?:if|continue-on-error):/mu
const e2eProjectsLine = /^ {12}projects: (.+)$/gmu
const projectPrefix = '--project='
const ciWorkflow = './.github/workflows/ci.yml'
const workflowCallEvent = /^ {2}workflow_call:/mu
const mainPushEvent = /^ {2}push:\n {4}branches: \[main\]$/mu
const versionGuardRun = /^\s+pnpm verify:release-version$/mu
const mainAncestryRun = /^\s+git merge-base --is-ancestor HEAD origin\/main$/mu
const fullE2ERun = /^pnpm e2e:full \$\{\{ matrix.projects \}\}$/u
const requiredJobs = ['lint', 'types', 'unit', 'build', 'e2e']
const requiredProjects = ['base-admin', 'foundation-admin', 'react-admin', 'react-demo', 'site']

/** Splits a workflow into its top-level jobs (two-space indented keys under `jobs:`). */
function workflowJobs(source) {
  const lines = source.split('\n')
  const start = lines.findIndex(line => jobsHeader.test(line))
  const jobs = new Map()
  if (start < 0)
    return jobs
  let current
  for (const line of lines.slice(start + 1)) {
    if (topLevelLine.test(line))
      break
    const header = jobHeader.exec(line)
    if (header) {
      current = { name: header[1], lines: [] }
      jobs.set(current.name, current)
    }
    else if (current) {
      current.lines.push(line)
    }
  }
  for (const job of jobs.values()) {
    job.source = job.lines.join('\n')
    job.uses = workflowUses.exec(job.source)?.[1]
    const needs = job.lines.map(line => needsLine.exec(line)?.[1]).find(Boolean) ?? ''
    job.needs = needs.replace(listBrackets, '').split(',').map(value => value.trim()).filter(Boolean)
    job.runs = job.lines.map(line => runLine.exec(line)?.[1]?.trim()).filter(Boolean)
    job.publish = job.lines.map(line => publishLine.exec(line)?.[1]?.trim()).filter(Boolean)
  }
  return jobs
}

function verifyConfiguration(candidateManifest, workflows) {
  if (candidateManifest.scripts.release !== releaseCommand)
    throw new Error(`The release script must be exactly "${releaseCommand}"; verification belongs to the workflow job it needs`)

  for (const [name, command] of Object.entries(candidateManifest.scripts)) {
    if (name === 'release')
      continue
    if (name.toLowerCase().includes('publish') || directPublishPattern.test(command))
      throw new Error(`Direct publish primitive is forbidden outside the guarded release script: ${name}`)
  }

  const publishers = []
  for (const [path, source] of workflows) {
    if (directPublishPattern.test(source))
      throw new Error(`Workflow contains a direct publish primitive: ${path}`)
    const jobs = workflowJobs(source)
    for (const job of jobs.values()) {
      if (job.runs.some(run => releaseRun.test(run)))
        throw new Error(`Workflow runs the release script outside the Changesets action: ${path}#${job.name}`)
      for (const value of job.publish)
        publishers.push({ path, job, jobs, value })
    }
  }
  if (publishers.length !== 1 || publishers[0].value !== 'pnpm run release')
    throw new Error(`The only workflow publish value must be pnpm run release: ${JSON.stringify(publishers.map(({ path, job, value }) => [path, job.name, value]))}`)

  const [{ path, job, jobs }] = publishers
  const releaseSource = workflows.find(([name]) => name === path)[1]
  const releaseEvents = releaseSource.split('\non:\n')[1]?.split('\npermissions:')[0]?.trim()
  if (releaseEvents !== 'push:\n    tags: [\'v*\']')
    throw new Error(`${path} must publish only from version tags, never from ordinary branch pushes`)
  const verifier = jobs.get('verification')
  if (job.needs.join(',') !== 'verification' || verifier?.uses !== ciWorkflow)
    throw new Error(`${path}#${job.name} must need the shared ${ciWorkflow} verification job`)
  if (verifier.needs.length > 0 || verifier.runs.length > 0 || optionalExecution.test(verifier.source) || optionalExecution.test(job.source))
    throw new Error(`${path} must not skip verification or publish after failed checks`)

  const ciSource = workflows.find(([path]) => path === 'ci.yml')?.[1] ?? ''
  if (!workflowCallEvent.test(ciSource) || !mainPushEvent.test(ciSource))
    throw new Error('ci.yml must verify main directly and be reusable by the tag publisher')
  const ciJobs = workflowJobs(ciSource)
  if (ciJobs.size !== requiredJobs.length || requiredJobs.some(name => !ciJobs.has(name)))
    throw new Error(`ci.yml must define the parallel jobs: ${requiredJobs.join(', ')}`)
  for (const check of ciJobs.values()) {
    // Failure-only artifact uploads are outside the checked execution steps.
    const execution = check.source.split('uses: actions/upload-artifact')[0]
    if (check.needs.length > 0 || optionalExecution.test(execution))
      throw new Error(`ci.yml#${check.name} must run independently without optional checks`)
  }
  const commands = [...ciJobs.values()].filter(check => check.name !== 'e2e').flatMap(check => check.runs)
  const expected = candidateManifest.scripts['verify:ci'].split(' && ')
  if (commands.length !== expected.length || expected.some(command => commands.filter(actual => actual === command).length !== 1))
    throw new Error('Parallel CI jobs must cover every verify:ci command exactly once')
  const e2e = ciJobs.get('e2e')
  if (!e2e.runs.some(run => fullE2ERun.test(run)))
    throw new Error('ci.yml#e2e must run the full E2E suite for each project group')
  const args = [...e2e.source.matchAll(e2eProjectsLine)].flatMap(match => match[1].split(' '))
  if (args.some(arg => !arg.startsWith(projectPrefix)) || args.map(arg => arg.slice(projectPrefix.length)).sort().join(',') !== requiredProjects.join(','))
    throw new Error('E2E groups must cover all five projects once without filtering tests')
  if (job.runs.some(run => verificationPattern.test(run) || e2ePattern.test(run)))
    throw new Error(`${path}#${job.name} must not repeat verification; it already needs ${verifier.name}`)
  if (!versionGuardRun.test(job.source) || !mainAncestryRun.test(job.source))
    throw new Error(`${path}#${job.name} must validate stable package versions and main ancestry`)
  const publishLine = job.lines.findIndex(line => publishKey.test(line))
  const buildLine = job.lines.findIndex(line => buildPackagesRun.test(line))
  if (buildLine < 0 || buildLine > publishLine)
    throw new Error(`${path}#${job.name} must run pnpm build:packages before publishing so tarballs contain dist`)
}

const workflowRoot = join(root, '.github/workflows')
const workflowPaths = (await readdir(workflowRoot)).filter(path => workflowFilePattern.test(path)).sort()
const workflows = await Promise.all(workflowPaths.map(async path => [path, await readFile(join(workflowRoot, path), 'utf8')]))

verifyConfiguration(manifest, workflows)

function expectConfigurationFailure(label, candidateManifest, candidateWorkflows) {
  try {
    verifyConfiguration(candidateManifest, candidateWorkflows)
  }
  catch {
    return
  }
  throw new Error(`Release guard accepted the ${label} bypass fixture`)
}

const releasePath = workflows.find(([, source]) => releasePublishValue.test(source))?.[0]
const replaceRelease = (from, to) => workflows.map(([path, source]) => [path, path === releasePath ? source.replace(from, to) : source])
const replaceCi = (from, to) => workflows.map(([path, source]) => [path, path === 'ci.yml' ? source.replace(from, to) : source])

expectConfigurationFailure('root script', {
  ...manifest,
  scripts: { ...manifest.scripts, 'unsafe-publish': 'changeset publish' },
}, workflows)
expectConfigurationFailure('verification inside release script', {
  ...manifest,
  scripts: { ...manifest.scripts, release: 'pnpm verify:release && changeset publish' },
}, workflows)
expectConfigurationFailure('workflow step', manifest, [
  ...workflows,
  ['unsafe.yml', 'jobs:\n  unsafe:\n    steps:\n      - run: pnpm exec changeset publish\n'],
])
expectConfigurationFailure('workflow release step', manifest, [
  ...workflows,
  ['unsafe.yml', 'jobs:\n  unsafe:\n    steps:\n      - run: pnpm run release\n'],
])
expectConfigurationFailure('missing needs', manifest, replaceRelease(/^ {4}needs:.*\n/mu, ''))
expectConfigurationFailure('missing shared workflow', manifest, replaceRelease(ciWorkflow, './.github/workflows/other.yml'))
expectConfigurationFailure('optional verification', manifest, replaceRelease('  verification:\n', '  verification:\n    if: false\n'))
expectConfigurationFailure('verification without e2e', manifest, replaceCi(/^.*run: pnpm e2e:full.*\n/mu, ''))
expectConfigurationFailure('verification with the smoke tests only', manifest, replaceCi(/pnpm e2e:full/u, 'pnpm e2e'))
expectConfigurationFailure('missing E2E project', manifest, replaceCi(' --project=site', ''))
expectConfigurationFailure('filtered E2E tests', manifest, replaceCi('--project=react-admin', '--project=react-admin --grep=@smoke'))
expectConfigurationFailure('verification without lint', manifest, replaceCi('run: pnpm lint', 'run: pnpm typecheck'))
expectConfigurationFailure('optional check', manifest, replaceCi('  unit:\n', '  unit:\n    if: false\n'))
expectConfigurationFailure('publishing on main', manifest, replaceRelease('tags: [\'v*\']', 'branches: [main]'))
expectConfigurationFailure('missing main checks', manifest, replaceCi('  push:\n    branches: [main]\n', ''))
expectConfigurationFailure('missing version guard', manifest, replaceRelease('pnpm verify:release-version', 'pnpm --version'))
expectConfigurationFailure('missing main ancestry guard', manifest, replaceRelease('git merge-base --is-ancestor HEAD origin/main', 'git status'))
expectConfigurationFailure('publish without build', manifest, replaceRelease(/run: pnpm build:packages/u, 'run: pnpm lint'))
expectConfigurationFailure('repeated verification', manifest, replaceRelease(/run: pnpm build:packages/u, 'run: pnpm build:packages && pnpm verify:ci'))

process.stdout.write(`Verified release guard: stable tags from main publish through Changesets only after shared full CI; main pushes cannot publish.\n`)
