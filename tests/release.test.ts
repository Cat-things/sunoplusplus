import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildVersion, desktopManifest, packageVersion } from '../scripts/build.ts'
import { nextVersion } from '../scripts/release.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('release versions', () => {
  it('bumps the patch of the last tag, unless package.json is ahead', () => {
    expect(nextVersion(null, '0.1.0')).toBe('0.1.0')
    expect(nextVersion('v0.1.0', '0.1.0')).toBe('0.1.1')
    expect(nextVersion('v0.1.9', '0.1.0')).toBe('0.1.10')
    expect(nextVersion('v0.1.4', '0.2.0')).toBe('0.2.0')
    expect(() => nextVersion(null, '1.0')).toThrow(/x\.y\.z/)
  })

  it('stamps builds with SUNOPLUSPLUS_VERSION when set', () => {
    expect(buildVersion()).toBe(packageVersion())
    vi.stubEnv('SUNOPLUSPLUS_VERSION', '2.3.4')
    expect(buildVersion()).toBe('2.3.4')
    vi.stubEnv('SUNOPLUSPLUS_VERSION', '2.3')
    expect(() => buildVersion()).toThrow(/x\.y\.z/)
  })
})

describe('desktop.json', () => {
  it('describes the files with sizes and SHA-256 hashes', () => {
    const bundle = Buffer.from('console.log("hi")')
    const catalog = Buffer.from('{"plugins":[]}')
    expect(desktopManifest('1.2.3', bundle, catalog)).toEqual({
      formatVersion: 1,
      version: '1.2.3',
      bridgeApi: 1,
      minDesktopVersion: '0.1.0',
      files: {
        bundle: {
          name: 'sunoplusplus.js',
          size: bundle.length,
          sha256: createHash('sha256').update(bundle).digest('hex')
        },
        catalog: {
          name: 'catalog.json',
          size: catalog.length,
          sha256: createHash('sha256').update(catalog).digest('hex')
        }
      }
    })
  })
})
