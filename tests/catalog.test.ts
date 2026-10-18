import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extensionManifest } from '../scripts/build.ts'
import { loadCatalog, registryOf, themeCssProblems } from '../scripts/lib/catalog.ts'
import { checkId, scaffold } from '../scripts/lib/scaffold.ts'

let root = ''

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'spp-catalog-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(file: string, contents: string): void {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), contents)
}

describe('scaffold + loadCatalog', () => {
  it('scaffolded plugins and themes pass validation as they are', () => {
    scaffold(root, 'plugin', 'my-plugin', 'Me')
    scaffold(root, 'theme', 'my-theme', 'Me')
    const catalog = loadCatalog(root)
    expect(catalog.errors).toEqual([])
    expect(catalog.plugins.map((p) => p.manifest.name)).toEqual(['My plugin'])
    expect(catalog.themes.map((t) => t.manifest.id)).toEqual(['my-theme'])
  })

  it('refuses bad ids and existing folders', () => {
    expect(checkId('My_Plugin')).toMatch(/lowercase/)
    expect(checkId('ab')).toMatch(/3 to 48/)
    expect(() => scaffold(root, 'plugin', 'Bad Id', 'Me')).toThrow(/not a valid id/)
    scaffold(root, 'plugin', 'taken', 'Me')
    expect(() => scaffold(root, 'plugin', 'taken', 'Me')).toThrow(/already exists/)
  })

  it('reports every problem with the file it is in', () => {
    scaffold(root, 'plugin', 'good', 'Me')
    write('plugins/no-files/manifest.json', '{ nope')
    write(
      'plugins/wrong-id/manifest.json',
      JSON.stringify({
        manifestVersion: 1,
        id: 'other-id',
        name: 'x',
        description: 'x',
        version: '1.0.0',
        authors: [{ name: 'x' }],
        license: 'MIT'
      })
    )
    write('plugins/wrong-id/index.ts', '')
    write('plugins/wrong-id/README.md', '')
    scaffold(root, 'theme', 'good-theme', 'Me')
    write('themes/good-theme/theme.css', '@import url(https://evil.example/x.css);')
    scaffold(root, 'theme', 'good', 'Me') // same id as the plugin

    const { errors, plugins, themes } = loadCatalog(root)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^plugins\/no-files\/manifest\.json: not valid JSON/),
        'plugins/no-files: index.ts is missing',
        'plugins/no-files: README.md is missing',
        'plugins/wrong-id/manifest.json: id "other-id" must match the folder name "wrong-id"',
        'themes/good-theme/theme.css: @import is not allowed; put all CSS in theme.css',
        'themes/good: id "good" is already used by plugins/good'
      ])
    )
    expect(plugins.map((p) => p.manifest.id)).toEqual(['good'])
    expect(themes).toEqual([])
  })

  it('builds a registry without $schema', () => {
    scaffold(root, 'plugin', 'my-plugin', 'Me')
    const registry = JSON.parse(JSON.stringify(registryOf(loadCatalog(root), '1.2.3'))) as {
      plugins: Record<string, unknown>[]
    }
    expect(registry.plugins[0]).toMatchObject({ id: 'my-plugin', path: 'plugins/my-plugin' })
    expect(registry.plugins[0]).not.toHaveProperty('$schema')
  })
})

describe('theme CSS rules', () => {
  it('allows plain CSS and data: URLs (including SVG namespaces)', () => {
    expect(
      themeCssProblems(
        ':root { --x: red } body { background: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'/>") }'
      )
    ).toEqual([])
    expect(themeCssProblems('/* see https://example.com for ideas */ a { color: red }')).toEqual([])
  })

  it('blocks imports, network loads and CSS scripting', () => {
    expect(themeCssProblems('@import "x.css";')).toContain(
      '@import is not allowed; put all CSS in theme.css'
    )
    expect(themeCssProblems('a { background: url(https://tracker.example/p.gif) }')[0]).toMatch(
      /only data: URLs/
    )
    expect(themeCssProblems("a { background: url('/local.png') }")[0]).toMatch(/only data: URLs/)
    expect(themeCssProblems('a { background: image-set("//cdn.example.com/x.png" 1x) }')).toContain(
      'themes cannot load anything from the network'
    )
    expect(themeCssProblems('a { width: expression(alert(1)) }')).toContain(
      'scripting in CSS is not allowed'
    )
  })
})

describe('extension manifest', () => {
  it('asks for as little as possible', () => {
    for (const browser of ['chrome', 'firefox'] as const) {
      const manifest = extensionManifest(browser, '1.0.0') as {
        permissions: string[]
        host_permissions?: string[]
        content_scripts: { matches: string[]; world?: string; js: string[] }[]
      }
      expect(manifest.permissions).toEqual(['storage'])
      expect(manifest.host_permissions).toBeUndefined()
      for (const script of manifest.content_scripts)
        expect(script.matches).toEqual(['https://suno.com/*'])
      expect(manifest.content_scripts.find((s) => s.world === 'MAIN')?.js).toEqual([
        'media-probe.js'
      ])
    }
    expect(extensionManifest('firefox', '1.0.0')).toMatchObject({
      browser_specific_settings: {
        gecko: {
          id: 'sunoplusplus@cat-things.github.io',
          data_collection_permissions: { required: ['none'] }
        }
      }
    })
    expect(extensionManifest('chrome', '1.0.0')).not.toHaveProperty('browser_specific_settings')
  })
})
