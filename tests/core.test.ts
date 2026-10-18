import { describe, expect, it } from 'vitest'
import {
  matchesUrl,
  resolveSettings,
  resolveThemeVariables,
  themeVariablesCss,
  type SettingDefinition
} from '@sunoplusplus/core'
import {
  manifestJsonSchemas,
  parsePluginManifest,
  parseThemeManifest
} from '@sunoplusplus/core/schema'

const plugin = {
  manifestVersion: 1,
  id: 'style-helper',
  name: 'Style helper',
  description: 'Suggests styles.',
  version: '1.0.0',
  authors: [{ name: 'Someone', github: 'someone' }],
  license: 'MIT'
}

const theme = { ...plugin, id: 'night-owl', name: 'Night owl', description: 'Dark.' }

function errorsOf(input: unknown): string[] {
  const result = parsePluginManifest(input)
  return result.ok ? [] : result.errors
}

describe('plugin manifests', () => {
  it('fills in defaults', () => {
    const result = parsePluginManifest(plugin)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.matches).toEqual(['https://suno.com/*'])
    expect(result.manifest.world).toBe('isolated')
    expect(result.manifest.enabledByDefault).toBe(false)
    expect(result.manifest.settings).toEqual([])
    expect(result.manifest.tags).toEqual([])
  })

  it('allows $schema for editors', () => {
    expect(parsePluginManifest({ ...plugin, $schema: '../../schemas/plugin.schema.json' }).ok).toBe(
      true
    )
  })

  it('rejects bad ids, versions and unknown keys with readable paths', () => {
    expect(errorsOf({ ...plugin, id: 'Style_Helper' })[0]).toMatch(/^id: use lowercase/)
    expect(errorsOf({ ...plugin, version: '1.0' })[0]).toMatch(/^version:/)
    expect(errorsOf({ ...plugin, versoin: '1.0.0' }).join()).toMatch(/versoin/)
    expect(errorsOf({ ...plugin, manifestVersion: 2 })[0]).toMatch(/^manifestVersion:/)
  })

  it('only allows suno.com patterns, never other sites or sign-in pages', () => {
    expect(parsePluginManifest({ ...plugin, matches: ['https://suno.com/create*'] }).ok).toBe(true)
    for (const bad of [
      'https://auth.suno.com/*',
      'https://*/*',
      'http://suno.com/*',
      'https://suno.com.evil.io/*',
      '*'
    ]) {
      expect(errorsOf({ ...plugin, matches: [bad] })[0]).toMatch(
        /^matches\[0\]: patterns must start with/
      )
    }
  })

  it('refuses the page world for now', () => {
    expect(errorsOf({ ...plugin, world: 'main' })[0]).toMatch(/^world: only "isolated"/)
  })

  it('requires a license that fits the MIT bundle', () => {
    expect(errorsOf({ ...plugin, license: 'GPL-3.0' })[0]).toMatch(/^license: must be one of MIT/)
  })

  it('checks settings definitions', () => {
    const ok = parsePluginManifest({
      ...plugin,
      settings: [
        { key: 'showArtist', type: 'boolean', label: 'Show artist', default: true },
        { key: 'count', type: 'number', label: 'Count', default: 3, min: 1, max: 5 },
        {
          key: 'mode',
          type: 'select',
          label: 'Mode',
          default: 'a',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' }
          ]
        },
        { key: 'prefix', type: 'string', label: 'Prefix', default: '♪' }
      ]
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.manifest.settings[3]).toMatchObject({ maxLength: 200 })

    const select = (value: string) => ({
      key: 'mode',
      type: 'select',
      label: 'Mode',
      default: value,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' }
      ]
    })
    expect(errorsOf({ ...plugin, settings: [select('c')] })[0]).toMatch(
      /^settings\[0\]\.default: default must be one of the option values/
    )
    expect(
      errorsOf({
        ...plugin,
        settings: [{ key: 'count', type: 'number', label: 'Count', default: 9, max: 5 }]
      })[0]
    ).toMatch(/default is outside min\/max/)
    expect(
      errorsOf({
        ...plugin,
        settings: [
          { key: 'a', type: 'boolean', label: 'A', default: true },
          { key: 'a', type: 'boolean', label: 'A again', default: false }
        ]
      })[0]
    ).toMatch(/^settings\[1\]: duplicate setting key "a"/)
    expect(
      errorsOf({
        ...plugin,
        settings: [{ key: 'Bad', type: 'boolean', label: 'x', default: true }]
      })[0]
    ).toMatch(/camelCase/)
  })
})

describe('theme manifests', () => {
  it('fills in defaults and checks variables', () => {
    const result = parseThemeManifest({
      ...theme,
      variables: [{ key: 'accent', label: 'Accent', type: 'color', default: '#ff2e97' }]
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.manifest.appearance).toBe('any')
    const bad = parseThemeManifest({
      ...theme,
      variables: [{ key: 'accent', label: 'Accent', type: 'color', default: 'hotpink' }]
    })
    expect(bad.ok ? [] : bad.errors).toEqual(['variables[0].default: use a #rrggbb color'])
  })

  it('does not accept plugin-only fields', () => {
    expect(parseThemeManifest({ ...theme, settings: [] }).ok).toBe(false)
  })
})

describe('JSON schemas', () => {
  it('exports schemas editors can use', () => {
    const { plugin: p, theme: t } = manifestJsonSchemas() as {
      plugin: { properties: Record<string, unknown>; required: string[] }
      theme: { properties: Record<string, unknown> }
    }
    expect(p.required).toEqual(expect.arrayContaining(['manifestVersion', 'id', 'name', 'version']))
    expect(p.required).not.toContain('matches')
    expect(Object.keys(t.properties)).toContain('variables')
  })
})

describe('matchesUrl', () => {
  it('matches origin + path + query, ignoring the hash', () => {
    expect(matchesUrl(['https://suno.com/*'], 'https://suno.com/')).toBe(true)
    expect(matchesUrl(['https://suno.com/create*'], 'https://suno.com/create?x=1#top')).toBe(true)
    expect(matchesUrl(['https://suno.com/create'], 'https://suno.com/create?x=1')).toBe(false)
    expect(matchesUrl(['https://suno.com/song/*'], 'https://suno.com/create')).toBe(false)
  })

  it('never matches other origins, even with a permissive pattern', () => {
    expect(matchesUrl(['https://suno.com/*'], 'https://auth.suno.com/sign-in')).toBe(false)
    expect(matchesUrl(['https://suno.com/*'], 'https://suno.com.evil.io/')).toBe(false)
    expect(matchesUrl(['*'], 'https://suno.com/')).toBe(false)
    expect(matchesUrl(['https://suno.com/*'], 'not a url')).toBe(false)
  })

  it('treats regex characters literally', () => {
    expect(matchesUrl(['https://suno.com/a.b'], 'https://suno.com/aXb')).toBe(false)
    expect(matchesUrl(['https://suno.com/a+b'], 'https://suno.com/a+b')).toBe(true)
  })
})

describe('settings resolution', () => {
  const defs: SettingDefinition[] = [
    { key: 'on', type: 'boolean', label: 'On', default: true },
    { key: 'n', type: 'number', label: 'N', default: 2, min: 1, max: 3 },
    { key: 's', type: 'string', label: 'S', default: 'x', maxLength: 3 },
    {
      key: 'm',
      type: 'select',
      label: 'M',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' }
      ]
    }
  ]

  it('uses stored values when valid and defaults otherwise', () => {
    expect(resolveSettings(defs, { on: false, n: 3, s: 'abc', m: 'b', extra: 1 })).toEqual({
      on: false,
      n: 3,
      s: 'abc',
      m: 'b'
    })
    expect(resolveSettings(defs, { on: 'yes', n: 9, s: 'abcd', m: 'z' })).toEqual({
      on: true,
      n: 2,
      s: 'x',
      m: 'a'
    })
    expect(resolveSettings(defs, null)).toEqual({ on: true, n: 2, s: 'x', m: 'a' })
    expect(Object.isFrozen(resolveSettings(defs, {}))).toBe(true)
  })

  it('resolves theme colors and writes custom properties', () => {
    const vars = [{ key: 'accent', label: 'Accent', type: 'color' as const, default: '#ff2e97' }]
    expect(resolveThemeVariables(vars, { accent: '#00FF00' })).toEqual({ accent: '#00FF00' })
    expect(resolveThemeVariables(vars, { accent: 'red; } body { display:none' })).toEqual({
      accent: '#ff2e97'
    })
    expect(themeVariablesCss({ accent: '#ff2e97' })).toBe(':root { --spp-accent: #ff2e97; }')
    expect(themeVariablesCss({ accent: 'red;}' })).toBe('')
  })
})
