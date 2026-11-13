#!/usr/bin/env node
import type { Stats } from 'node:fs'
import { spawn } from 'node:child_process'
// node:fs only — fs-extra is CJS and its named ESM imports crash the built CLI under plain Node.
import { realpathSync } from 'node:fs'
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { input } from '@inquirer/prompts'
import { Command } from 'commander'
import { green } from 'kolorist'

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

async function assertEmptyTarget(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (!stat.isDirectory())
      throw new Error(`Target path "${path}" exists and is not a directory`)
    if ((await readdir(path)).length > 0)
      throw new Error(`Target directory "${path}" is not empty`)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return
    throw error
  }
}

export interface CreateAppOptions {
  name?: string
  cwd?: string
  template?: TemplateName
  pm?: 'pnpm' | 'npm' | 'yarn'
  install?: boolean
  git?: boolean
  /** Writes the Lumi skill; `false` leaves it out. */
  ai?: boolean
}

export type TemplateName = 'react'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATES_ROOT = join(PACKAGE_ROOT, 'templates')
const AI_ROOT = join(PACKAGE_ROOT, 'ai')
// One skill source, placed where Claude Code (.claude) and other agents (.agents) look for project skills.
const AI_FILES: ReadonlyArray<readonly [source: string, target: string]> = [
  ['SKILL.md', '.claude/skills/lumi/SKILL.md'],
  ['SKILL.md', '.agents/skills/lumi/SKILL.md'],
]
const PACKAGE_NAME_CHARS_RE = /[^\w-]+/g
const PACKAGE_NAME_EDGE_DASH_RE = /^-+|-+$/g
const TITLE_SEPARATOR_RE = /[-_]+/g
const PLACEHOLDER_RE = /\{\{([A-Z_]+)\}\}/g

function normalizePackageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(PACKAGE_NAME_CHARS_RE, '-')
    .replace(PACKAGE_NAME_EDGE_DASH_RE, '') || 'lumi-app'
}

function toTitle(name: string): string {
  const words = name.replace(TITLE_SEPARATOR_RE, ' ').trim()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : name
}

function parsePackageManager(value: string | undefined): CreateAppOptions['pm'] {
  if (value === 'npm' || value === 'yarn' || value === 'pnpm')
    return value
  if (process.env.npm_config_user_agent?.startsWith('yarn'))
    return 'yarn'
  if (process.env.npm_config_user_agent?.startsWith('npm'))
    return 'npm'
  return 'pnpm'
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0)
        resolvePromise()
      else
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function isTemplateName(value: string): value is TemplateName {
  return value === 'react'
}

function resolveTemplate(value: string | undefined): TemplateName {
  const template = value ?? 'react'
  if (!isTemplateName(template))
    throw new Error(`Unknown template "${template}"`)
  return template
}

function renderTemplate(source: string, replacements: Record<string, string>): string {
  return source.replace(PLACEHOLDER_RE, (_, key: string) => replacements[key] ?? '')
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current)
  const files: string[] = []
  for (const entry of entries) {
    const path = join(current, entry)
    const stat: Stats = await lstat(path)
    if (stat.isDirectory())
      files.push(...await walkFiles(root, path))
    else
      files.push(relative(root, path))
  }
  return files
}

async function resolveProjectName(name: string | undefined): Promise<string> {
  if (name)
    return name
  return input({ message: 'Project name', default: 'lumi-app' })
}

/** Scaffolds a project from a template into a new, empty directory, adds the AI files unless `ai` is false, optionally installs dependencies and runs `git init`; answers the project's path. */
export async function createApp(options: CreateAppOptions = {}): Promise<string> {
  const projectName = await resolveProjectName(options.name)
  const pm = parsePackageManager(options.pm)
  const template = resolveTemplate(options.template)
  const sourceRoot = join(TEMPLATES_ROOT, template)

  const root = resolve(options.cwd ?? process.cwd(), projectName)
  const packageJson = JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }
  const replacements = {
    LUMI_VERSION: packageJson.version,
    PACKAGE_NAME: normalizePackageName(projectName),
    PROJECT_NAME: projectName,
    PROJECT_TITLE: toTitle(projectName),
    PM: pm ?? 'pnpm',
  }

  await assertEmptyTarget(root)
  await ensureDir(root)
  for (const file of await walkFiles(sourceRoot)) {
    const source = await readFile(join(sourceRoot, file), 'utf8')
    const target = join(root, file)
    await ensureDir(dirname(target))
    await writeFile(target, renderTemplate(source, replacements))
  }

  if (options.ai !== false) {
    for (const [source, file] of AI_FILES) {
      const target = join(root, file)
      await ensureDir(dirname(target))
      await writeFile(target, renderTemplate(await readFile(join(AI_ROOT, source), 'utf8'), replacements))
    }
  }

  if (options.install === true)
    await runCommand(pm ?? 'pnpm', ['install'], root)
  if (options.git === true)
    await runCommand('git', ['init'], root)

  return root
}

/** The `create-lumi` command line program. */
export function createProgram(): Command {
  const program = new Command()
  program
    .name('create-lumi')
    .argument('[target-dir]')
    .option('--template <name>', 'template name (react)', 'react')
    .option('--pm <name>', 'package manager')
    .option('--no-install', 'skip dependency installation')
    .option('--no-git', 'skip git initialization')
    .option('--no-ai', 'skip the Lumi skill')
    .action(async (targetDir: string | undefined, opts: Record<string, unknown>) => {
      const template = resolveTemplate(String(opts.template ?? 'react'))
      const root = await createApp({
        name: targetDir,
        template,
        pm: parsePackageManager(typeof opts.pm === 'string' ? opts.pm : undefined),
        install: opts.install !== false,
        git: opts.git !== false,
        ai: opts.ai !== false,
      })
      process.stdout.write(`${green('Created')} ${root}\n`)
    })

  return program
}

async function main(argv: string[]): Promise<void> {
  await createProgram().parseAsync(argv, { from: 'user' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
