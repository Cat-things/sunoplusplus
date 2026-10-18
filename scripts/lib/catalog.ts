/**
 * Reads plugins/ and themes/, validates every folder and returns what the build bundles. Every
 * rule a community submission has to follow is checked here (or by the import guard in
 * build.ts), so `pnpm validate` tells contributors exactly what to fix.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  parsePluginManifest,
  parseThemeManifest,
  type PluginManifest,
  type ThemeManifest
} from '../../packages/core/src/schema.ts'

export interface PluginEntry {
  readonly dir: string
  readonly manifest: PluginManifest
  readonly entry: string
}

export interface ThemeEntry {
  readonly dir: string
  readonly manifest: ThemeManifest
  readonly css: string
}

export interface LoadedCatalog {
  readonly plugins: PluginEntry[]
  readonly themes: ThemeEntry[]
  readonly errors: string[]
}

export const MAX_PLUGIN_BYTES = 256 * 1024
export const MAX_THEME_BYTES = 200 * 1024

function folders(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort()
}

function folderBytes(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += statSync(path.join(entry.parentPath, entry.name)).size
  }
  return total
}

function readManifest(file: string, errors: string[], label: string): unknown {
  if (!existsSync(file)) {
    errors.push(`${label}/manifest.json: missing`)
    return undefined
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch (error) {
    errors.push(`${label}/manifest.json: not valid JSON (${(error as Error).message})`)
    return undefined
  }
}

/**
 * Themes may only style the page: no @import, no fetching anything from the network (which
 * could track users) and no CSS-based scripting. data: URLs are fine.
 */
export function themeCssProblems(css: string): string[] {
  const problems: string[] = []
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/@import\b/i.test(code)) problems.push('@import is not allowed; put all CSS in theme.css')
  const withoutData = code.replace(/url\(\s*(['"]?)\s*data:[\s\S]*?\1\s*\)/gi, 'url()')
  for (const match of withoutData.matchAll(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi)) {
    const target = (match[2] ?? '').trim()
    if (target !== '') problems.push(`url(${target}) is not allowed; only data: URLs can be used`)
  }
  if (/(?:https?:)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(withoutData.replace(/url\(\)/g, ''))) {
    problems.push('themes cannot load anything from the network')
  }
  if (/expression\s*\(|javascript:|-moz-binding|behavior\s*:/i.test(code)) {
    problems.push('scripting in CSS is not allowed')
  }
  return problems
}

export function loadCatalog(root: string): LoadedCatalog {
  const errors: string[] = []
  const plugins: PluginEntry[] = []
  const themes: ThemeEntry[] = []
  const owners = new Map<string, string>()

  const claim = (id: string, label: string): void => {
    const other = owners.get(id)
    if (other) errors.push(`${label}: id "${id}" is already used by ${other}`)
    else owners.set(id, label)
  }

  for (const name of folders(path.join(root, 'plugins'))) {
    const label = `plugins/${name}`
    const dir = path.join(root, 'plugins', name)
    const before = errors.length
    const raw = readManifest(path.join(dir, 'manifest.json'), errors, label)
    const result = raw === undefined ? null : parsePluginManifest(raw)
    if (result && !result.ok)
      for (const e of result.errors) errors.push(`${label}/manifest.json: ${e}`)
    const entry = path.join(dir, 'index.ts')
    if (!existsSync(entry)) errors.push(`${label}: index.ts is missing`)
    if (!existsSync(path.join(dir, 'README.md'))) errors.push(`${label}: README.md is missing`)
    if (folderBytes(dir) > MAX_PLUGIN_BYTES)
      errors.push(`${label}: larger than ${MAX_PLUGIN_BYTES / 1024} KB`)
    if (result?.ok) {
      if (result.manifest.id !== name) {
        errors.push(
          `${label}/manifest.json: id "${result.manifest.id}" must match the folder name "${name}"`
        )
      }
      claim(result.manifest.id, label)
      if (errors.length === before) plugins.push({ dir, manifest: result.manifest, entry })
    }
  }

  for (const name of folders(path.join(root, 'themes'))) {
    const label = `themes/${name}`
    const dir = path.join(root, 'themes', name)
    const before = errors.length
    const raw = readManifest(path.join(dir, 'manifest.json'), errors, label)
    const result = raw === undefined ? null : parseThemeManifest(raw)
    if (result && !result.ok)
      for (const e of result.errors) errors.push(`${label}/manifest.json: ${e}`)
    const cssFile = path.join(dir, 'theme.css')
    let css = ''
    if (!existsSync(cssFile)) {
      errors.push(`${label}: theme.css is missing`)
    } else {
      css = readFileSync(cssFile, 'utf8')
      if (Buffer.byteLength(css) > MAX_THEME_BYTES) {
        errors.push(`${label}/theme.css: larger than ${MAX_THEME_BYTES / 1024} KB`)
      }
      for (const problem of themeCssProblems(css)) errors.push(`${label}/theme.css: ${problem}`)
    }
    if (!existsSync(path.join(dir, 'README.md'))) errors.push(`${label}: README.md is missing`)
    if (result?.ok) {
      if (result.manifest.id !== name) {
        errors.push(
          `${label}/manifest.json: id "${result.manifest.id}" must match the folder name "${name}"`
        )
      }
      claim(result.manifest.id, label)
      if (errors.length === before) themes.push({ dir, manifest: result.manifest, css })
    }
  }

  return { plugins, themes, errors }
}

/** The public index of everything in the catalog, for the future marketplace and Suno Desktop. */
export function registryOf(catalog: LoadedCatalog, version: string): unknown {
  return {
    formatVersion: 1,
    sunoplusplusVersion: version,
    plugins: catalog.plugins.map((p) => ({
      ...p.manifest,
      $schema: undefined,
      path: `plugins/${p.manifest.id}`
    })),
    themes: catalog.themes.map((t) => ({
      ...t.manifest,
      $schema: undefined,
      path: `themes/${t.manifest.id}`
    }))
  }
}
