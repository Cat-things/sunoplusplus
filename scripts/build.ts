/**
 * Builds everything into dist/:
 *
 *   dist/extension/chrome/   unpacked browser extension (Chrome, Edge, Brave, Opera)
 *   dist/extension/firefox/  unpacked browser extension (Firefox 128+)
 *   dist/desktop/            bundle + catalog.json for Suno Desktop (see docs/DESKTOP.md)
 *   dist/registry.json       index of every plugin and theme, for the future marketplace
 *
 *   node scripts/build.ts            one-off build
 *   node scripts/build.ts --watch    rebuild on changes
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'
import { manifestJsonSchemas } from '../packages/core/src/schema.ts'
import { loadCatalog, registryOf, type LoadedCatalog } from './lib/catalog.ts'

export const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const extensionSrc = path.join(root, 'packages/extension')
const chromeDir = path.join(dist, 'extension/chrome')
const firefoxDir = path.join(dist, 'extension/firefox')
const pluginsDir = path.join(root, 'plugins')

export function packageVersion(): string {
  return (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string })
    .version
}

/** JSON Schema files referenced by `$schema` in manifest.json. */
export function schemaFiles(): Record<string, string> {
  const { plugin, theme } = manifestJsonSchemas()
  return {
    'schemas/plugin.schema.json': `${JSON.stringify(plugin, null, 2)}\n`,
    'schemas/theme.schema.json': `${JSON.stringify(theme, null, 2)}\n`
  }
}

function catalogModule(catalog: LoadedCatalog, withCode: boolean): string {
  const lines: string[] = []
  const plugins = catalog.plugins.map((plugin, i) => {
    if (withCode) lines.push(`import plugin${i} from ${JSON.stringify(plugin.entry)};`)
    const manifest = JSON.stringify({ ...plugin.manifest, $schema: undefined })
    return withCode ? `{ manifest: ${manifest}, module: plugin${i} }` : `{ manifest: ${manifest} }`
  })
  const themes = catalog.themes.map((theme) => {
    const manifest = JSON.stringify({ ...theme.manifest, $schema: undefined })
    return withCode
      ? `{ manifest: ${manifest}, css: ${JSON.stringify(theme.css)} }`
      : `{ manifest: ${manifest} }`
  })
  lines.push(
    `export const catalog = { plugins: [${plugins.join(', ')}], themes: [${themes.join(', ')}] };`
  )
  return lines.join('\n')
}

/**
 * Provides the `sunoplusplus:catalog` (manifests + code) and `sunoplusplus:catalog-meta`
 * (manifests only) modules, and enforces that plugins only import the SDK and their own files.
 */
export function catalogPlugin(): esbuild.Plugin {
  return {
    name: 'sunoplusplus-catalog',
    setup(build) {
      build.onResolve({ filter: /^sunoplusplus:catalog(-meta)?$/ }, (args) => ({
        path: args.path,
        namespace: 'sunoplusplus'
      }))
      build.onLoad({ filter: /.*/, namespace: 'sunoplusplus' }, (args) => {
        const catalog = loadCatalog(root)
        const watchDirs = [
          pluginsDir,
          path.join(root, 'themes'),
          ...catalog.plugins.map((p) => p.dir),
          ...catalog.themes.map((t) => t.dir)
        ]
        if (catalog.errors.length > 0) {
          return { errors: catalog.errors.map((text) => ({ text })), watchDirs }
        }
        return {
          contents: catalogModule(catalog, args.path === 'sunoplusplus:catalog'),
          loader: 'js',
          resolveDir: root,
          watchDirs,
          watchFiles: catalog.themes.map((t) => path.join(t.dir, 'theme.css'))
        }
      })
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!args.importer.startsWith(pluginsDir + path.sep)) return undefined
        const pluginName = path.relative(pluginsDir, args.importer).split(path.sep)[0] ?? ''
        const pluginDir = path.join(pluginsDir, pluginName)
        const where = path.relative(root, args.importer)
        if (args.kind === 'dynamic-import') {
          return {
            errors: [{ text: `${where}: plugins cannot load code at runtime; bundle everything` }]
          }
        }
        if (args.path === '@sunoplusplus/sdk') return undefined
        if (args.path.startsWith('.')) {
          const target = path.resolve(path.dirname(args.importer), args.path)
          if (target.startsWith(pluginDir + path.sep)) return undefined
        }
        return {
          errors: [
            {
              text: `${where}: plugins can only import "@sunoplusplus/sdk" and files in their own folder, not "${args.path}"`
            }
          ]
        }
      })
    }
  }
}

const common: esbuild.BuildOptions = {
  bundle: true,
  format: 'iife',
  target: ['chrome120', 'firefox128'],
  // Readable output: easier for store reviewers and for anyone who wants to check what runs.
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  loader: { '.css': 'text' },
  logLevel: 'warning'
}

export function extensionBuildOptions(write = true): esbuild.BuildOptions {
  return {
    ...common,
    entryPoints: {
      content: path.join(extensionSrc, 'src/content.ts'),
      'media-probe': path.join(extensionSrc, 'src/media-probe.ts'),
      options: path.join(extensionSrc, 'src/options.ts')
    },
    outdir: chromeDir,
    write,
    plugins: [catalogPlugin(), syncFirefoxPlugin()]
  }
}

function desktopBuildOptions(): esbuild.BuildOptions {
  return {
    ...common,
    entryPoints: { sunoplusplus: path.join(root, 'packages/desktop/src/index.ts') },
    outdir: path.join(dist, 'desktop'),
    plugins: [catalogPlugin()]
  }
}

export function extensionManifest(browser: 'chrome' | 'firefox', version: string): object {
  const icons = {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png'
  }
  const matches = ['https://suno.com/*']
  return {
    manifest_version: 3,
    name: 'Suno++',
    version,
    description:
      'Community plugins and themes for Suno. Unofficial; not affiliated with Suno, Inc.',
    homepage_url: 'https://github.com/Cat-things/sunoplusplus',
    icons,
    action: { default_title: 'Suno++', default_popup: 'popup.html', default_icon: icons },
    options_ui: { page: 'options.html', open_in_tab: true },
    permissions: ['storage'],
    content_scripts: [
      // Sees audio Suno plays outside the DOM; reports only playing/paused/none.
      { matches, js: ['media-probe.js'], run_at: 'document_start', world: 'MAIN' },
      { matches, js: ['content.js'], run_at: 'document_start' }
    ],
    ...(browser === 'chrome'
      ? { minimum_chrome_version: '120' }
      : {
          browser_specific_settings: {
            gecko: {
              id: 'sunoplusplus@cat-things.github.io',
              strict_min_version: '128.0',
              data_collection_permissions: { required: ['none'] }
            }
          }
        })
  }
}

function writeStaticFiles(version: string): void {
  mkdirSync(chromeDir, { recursive: true })
  for (const file of ['options.html', 'popup.html', 'options.css']) {
    cpSync(path.join(extensionSrc, 'static', file), path.join(chromeDir, file))
  }
  cpSync(path.join(extensionSrc, 'icons'), path.join(chromeDir, 'icons'), { recursive: true })
  writeFileSync(
    path.join(chromeDir, 'manifest.json'),
    `${JSON.stringify(extensionManifest('chrome', version), null, 2)}\n`
  )
}

/** The Firefox build is the Chrome build with its own manifest. */
function syncFirefox(version: string): void {
  if (!existsSync(chromeDir)) return
  rmSync(firefoxDir, { recursive: true, force: true })
  cpSync(chromeDir, firefoxDir, { recursive: true })
  writeFileSync(
    path.join(firefoxDir, 'manifest.json'),
    `${JSON.stringify(extensionManifest('firefox', version), null, 2)}\n`
  )
}

function syncFirefoxPlugin(): esbuild.Plugin {
  return {
    name: 'sunoplusplus-firefox',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0 && build.initialOptions.write !== false)
          syncFirefox(packageVersion())
      })
    }
  }
}

function writeOutputs(catalog: LoadedCatalog, version: string): void {
  for (const [file, contents] of Object.entries(schemaFiles())) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), contents)
  }
  const registry = `${JSON.stringify(registryOf(catalog, version), null, 2)}\n`
  mkdirSync(path.join(dist, 'desktop'), { recursive: true })
  writeFileSync(path.join(dist, 'registry.json'), registry)
  writeFileSync(path.join(dist, 'desktop/catalog.json'), registry)
}

async function main(): Promise<void> {
  const watch = process.argv.includes('--watch')
  const catalog = loadCatalog(root)
  if (catalog.errors.length > 0) {
    console.error(
      `Fix these first (pnpm validate shows the same list):\n${catalog.errors.map((e) => `  ✗ ${e}`).join('\n')}`
    )
    process.exit(1)
  }
  const version = packageVersion()
  rmSync(dist, { recursive: true, force: true })
  writeStaticFiles(version)
  writeOutputs(catalog, version)
  if (watch) {
    const contexts = await Promise.all([
      esbuild.context(extensionBuildOptions()),
      esbuild.context(desktopBuildOptions())
    ])
    await Promise.all(contexts.map((c) => c.watch()))
    console.log(
      'Watching for changes. Reload the extension after a rebuild; restart this after adding a plugin or theme folder.'
    )
    return
  }
  await esbuild.build(extensionBuildOptions())
  await esbuild.build(desktopBuildOptions())
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  console.log(
    `Built Suno++ ${version} with ${count(catalog.plugins.length, 'plugin')} and ${count(catalog.themes.length, 'theme')}:`
  )
  for (const dir of [
    'dist/extension/chrome',
    'dist/extension/firefox',
    'dist/desktop',
    'dist/registry.json'
  ])
    console.log(`  ${dir}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
