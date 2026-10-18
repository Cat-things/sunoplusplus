import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackState, PluginManifest, Route, Song, ThemeManifest } from '@sunoplusplus/core'
import {
  EMPTY_STATE,
  Emitter,
  Runtime,
  THEME_STYLE_ID,
  memoryStorage,
  normalizeState,
  routeOf,
  type Catalog,
  type CatalogPlugin,
  type Host,
  type UserState
} from '@sunoplusplus/runtime'
import { definePlugin, type PluginContext } from '@sunoplusplus/sdk'

function fakeHost(url = 'https://suno.com/') {
  const routes = new Emitter<Route>()
  const songs = new Emitter<Song | null>()
  const playbacks = new Emitter<PlaybackState>()
  let route = routeOf(url)
  let song: Song | null = null
  let playback: PlaybackState = 'none'
  const storages = new Map<string, ReturnType<typeof memoryStorage>>()
  const host: Host = {
    env: { kind: 'extension', apiVersion: 1 },
    currentRoute: () => route,
    onRoute: (l) => routes.on(l),
    currentSong: () => song,
    onSong: (l) => songs.on(l),
    currentPlayback: () => playback,
    onPlayback: (l) => playbacks.on(l),
    storage: (id) => {
      const existing = storages.get(id)
      if (existing) return existing
      const created = memoryStorage()
      storages.set(id, created)
      return created
    }
  }
  return {
    host,
    navigate(next: string) {
      route = routeOf(next)
      routes.emit(route)
    },
    play(next: Song | null, state: PlaybackState = 'playing') {
      song = next
      songs.emit(song)
      playback = state
      playbacks.emit(state)
    }
  }
}

function manifest(id: string, extra: Partial<PluginManifest> = {}): PluginManifest {
  return {
    manifestVersion: 1,
    id,
    name: id,
    description: id,
    version: '1.0.0',
    authors: [{ name: 'Test' }],
    license: 'MIT',
    tags: [],
    matches: ['https://suno.com/*'],
    world: 'isolated',
    enabledByDefault: false,
    settings: [],
    ...extra
  }
}

function themeManifest(id: string, extra: Partial<ThemeManifest> = {}): ThemeManifest {
  return {
    manifestVersion: 1,
    id,
    name: id,
    description: id,
    version: '1.0.0',
    authors: [{ name: 'Test' }],
    license: 'MIT',
    tags: [],
    matches: ['https://suno.com/*'],
    appearance: 'any',
    variables: [],
    ...extra
  }
}

function on(...ids: string[]): UserState {
  return { ...EMPTY_STATE, enabled: Object.fromEntries(ids.map((id) => [id, true])) }
}

const song: Song = { title: 'Neon Rain', artist: 'Cat', album: '', artwork: [] }

afterEach(() => {
  document.head.replaceChildren()
})

describe('Runtime plugins', () => {
  it('runs enabled plugins and stops them when turned off, running their cleanups', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const catalog: Catalog = {
      plugins: [{ manifest: manifest('a'), module: definePlugin(setup) }],
      themes: []
    }
    const runtime = new Runtime({ host: fakeHost().host, catalog })
    runtime.start(EMPTY_STATE)
    expect(setup).not.toHaveBeenCalled()
    runtime.setState(on('a'))
    expect(setup).toHaveBeenCalledOnce()
    expect(runtime.runningPlugins()).toEqual(['a'])
    runtime.setState(on())
    expect(cleanup).toHaveBeenCalledOnce()
    expect(runtime.runningPlugins()).toEqual([])
  })

  it('honours enabledByDefault and lets the user override it', () => {
    const setup = vi.fn()
    const catalog: Catalog = {
      plugins: [
        { manifest: manifest('a', { enabledByDefault: true }), module: definePlugin(setup) }
      ],
      themes: []
    }
    const runtime = new Runtime({ host: fakeHost().host, catalog })
    runtime.start(EMPTY_STATE)
    expect(runtime.runningPlugins()).toEqual(['a'])
    runtime.setState({ ...EMPTY_STATE, enabled: { a: false } })
    expect(runtime.runningPlugins()).toEqual([])
  })

  it('follows matches across client-side navigation and delivers routes once', () => {
    const fake = fakeHost('https://suno.com/')
    const routes: string[] = []
    const cleanup = vi.fn()
    const catalog: Catalog = {
      plugins: [
        {
          manifest: manifest('create-only', { matches: ['https://suno.com/create*'] }),
          module: definePlugin((ctx) => {
            ctx.onRoute((r) => routes.push(r.path))
            return cleanup
          })
        }
      ],
      themes: []
    }
    const runtime = new Runtime({ host: fake.host, catalog })
    runtime.start(on('create-only'))
    expect(runtime.runningPlugins()).toEqual([])
    fake.navigate('https://suno.com/create')
    fake.navigate('https://suno.com/create?tab=lyrics')
    fake.navigate('https://suno.com/create?tab=lyrics') // same URL: ignored
    fake.navigate('https://suno.com/library')
    expect(routes).toEqual(['/create', '/create?tab=lyrics'])
    expect(cleanup).toHaveBeenCalledOnce()
    expect(runtime.runningPlugins()).toEqual([])
  })

  it('gives plugins the current song and playback right away and on changes', () => {
    const fake = fakeHost()
    fake.play(song, 'paused')
    const seen: unknown[] = []
    const catalog: Catalog = {
      plugins: [
        {
          manifest: manifest('a'),
          module: definePlugin((ctx) => {
            ctx.onSongChanged((s) => seen.push(s?.title ?? null))
            ctx.onPlaybackStateChanged((s) => seen.push(s))
          })
        }
      ],
      themes: []
    }
    new Runtime({ host: fake.host, catalog }).start(on('a'))
    fake.play(null, 'none')
    expect(seen).toEqual(['Neon Rain', 'paused', null, 'none'])
  })

  it('isolates failures: a throwing plugin does not stop the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const good = vi.fn()
    const partialCleanup = vi.fn()
    const catalog: Catalog = {
      plugins: [
        {
          manifest: manifest('bad'),
          module: definePlugin((ctx) => {
            ctx.onCleanup(partialCleanup)
            throw new Error('boom')
          })
        },
        {
          manifest: manifest('listener-throws'),
          module: definePlugin((ctx) => {
            ctx.onRoute(() => {
              throw new Error('listener boom')
            })
          })
        },
        { manifest: manifest('good'), module: definePlugin(good) }
      ],
      themes: []
    }
    const fake = fakeHost()
    const runtime = new Runtime({ host: fake.host, catalog })
    runtime.start(on('bad', 'listener-throws', 'good'))
    fake.navigate('https://suno.com/x')
    expect(good).toHaveBeenCalledOnce()
    expect(partialCleanup).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith('[Suno++ bad]', 'failed to start', expect.any(Error))
    expect(error).toHaveBeenCalledWith('[Suno++ listener-throws]', expect.any(Error))
    // A failed plugin is not retried on every navigation.
    expect(runtime.runningPlugins()).toContain('bad')
    error.mockRestore()
  })

  it('handles async setup, including a cleanup that arrives after the plugin stopped', async () => {
    const cleanup = vi.fn()
    let release: () => void = () => undefined
    const catalog: Catalog = {
      plugins: [
        {
          manifest: manifest('slow'),
          module: definePlugin(async () => {
            await new Promise<void>((resolve) => (release = resolve))
            return cleanup
          })
        }
      ],
      themes: []
    }
    const runtime = new Runtime({ host: fakeHost().host, catalog })
    runtime.start(on('slow'))
    runtime.setState(on())
    release()
    await new Promise((r) => setTimeout(r, 0))
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('aborts ctx.signal, removes styles and ignores calls after stop', () => {
    let ctx: PluginContext | undefined
    const catalog: Catalog = {
      plugins: [
        {
          manifest: manifest('a'),
          module: definePlugin((c) => {
            ctx = c
            c.addStyle('body { color: red }')
          })
        }
      ],
      themes: []
    }
    const runtime = new Runtime({ host: fakeHost().host, catalog })
    runtime.start(on('a'))
    expect(document.querySelector('style[data-sunoplusplus-plugin="a"]')?.textContent).toBe(
      'body { color: red }'
    )
    runtime.setState(on())
    expect(ctx?.signal.aborted).toBe(true)
    expect(document.querySelector('style[data-sunoplusplus-plugin]')).toBeNull()
    const late = vi.fn()
    ctx?.onCleanup(late)
    expect(late).toHaveBeenCalledOnce()
    ctx?.addStyle('p {}')
    expect(document.querySelector('style[data-sunoplusplus-plugin]')).toBeNull()
  })

  it('resolves settings and pushes changes to running plugins without a restart', () => {
    const setup = vi.fn()
    const changes: unknown[] = []
    const plugin: CatalogPlugin = {
      manifest: manifest('a', {
        settings: [{ key: 'showArtist', type: 'boolean', label: 'Show artist', default: true }]
      }),
      module: definePlugin<{ showArtist: boolean }>((ctx) => {
        setup(ctx.settings.get('showArtist'))
        ctx.settings.onChange((s) => changes.push(s.showArtist))
      })
    }
    const runtime = new Runtime({
      host: fakeHost().host,
      catalog: { plugins: [plugin], themes: [] }
    })
    runtime.start(on('a'))
    runtime.setState({ ...on('a'), settings: { a: { showArtist: false } } })
    runtime.setState({ ...on('a'), settings: { a: { showArtist: false, junk: 1 } } }) // no change
    runtime.setState({ ...on('a'), settings: { a: { showArtist: 'nope' } } }) // invalid → default
    expect(setup).toHaveBeenCalledOnce()
    expect(setup).toHaveBeenCalledWith(true)
    expect(changes).toEqual([false, true])
  })

  it('namespaces storage per plugin', async () => {
    const values: unknown[] = []
    const catalog: Catalog = {
      plugins: ['a', 'b'].map((id) => ({
        manifest: manifest(id),
        module: definePlugin(async (ctx) => {
          await ctx.storage.set('k', id)
          values.push(await ctx.storage.get('k'))
        })
      })),
      themes: []
    }
    new Runtime({ host: fakeHost().host, catalog }).start(on('a', 'b'))
    await new Promise((r) => setTimeout(r, 0))
    expect(values.sort()).toEqual(['a', 'b'])
  })

  it('waits for the DOM before starting plugins', () => {
    const setup = vi.fn()
    const fakeDoc = Object.assign(new EventTarget(), {
      readyState: 'loading',
      head: document.head,
      documentElement: document.documentElement,
      createElement: (tag: string) => document.createElement(tag)
    }) as unknown as Document
    const runtime = new Runtime({
      host: fakeHost().host,
      document: fakeDoc,
      catalog: { plugins: [{ manifest: manifest('a'), module: definePlugin(setup) }], themes: [] }
    })
    runtime.start(on('a'))
    expect(setup).not.toHaveBeenCalled()
    fakeDoc.dispatchEvent(new Event('DOMContentLoaded'))
    expect(setup).toHaveBeenCalledOnce()
  })

  it('starts plugins when start() comes after the DOM finished loading', () => {
    // The extension builds the runtime at document_start and starts it after an async storage
    // read, by which time DOMContentLoaded has already fired.
    const setup = vi.fn()
    const fakeDoc = Object.assign(new EventTarget(), {
      readyState: 'loading',
      head: document.head,
      documentElement: document.documentElement,
      createElement: (tag: string) => document.createElement(tag)
    })
    const fake = fakeHost('https://suno.com/')
    const runtime = new Runtime({
      host: fake.host,
      document: fakeDoc as unknown as Document,
      catalog: { plugins: [{ manifest: manifest('a'), module: definePlugin(setup) }], themes: [] }
    })
    fakeDoc.readyState = 'interactive'
    fake.navigate('https://suno.com/create') // before start: must not be missed either
    runtime.start(on('a'))
    expect(setup).toHaveBeenCalledOnce()
    expect((setup.mock.calls[0]?.[0] as PluginContext | undefined)?.id).toBe('a')
  })

  it('picks up the route and song current at start(), not at construction', () => {
    const fake = fakeHost('https://suno.com/')
    const seen: string[] = []
    const runtime = new Runtime({
      host: fake.host,
      catalog: {
        plugins: [
          {
            manifest: manifest('a'),
            module: definePlugin((ctx) => {
              ctx.onRoute((r) => seen.push(r.path))
              ctx.onSongChanged((s) => seen.push(s?.title ?? 'none'))
            })
          }
        ],
        themes: []
      }
    })
    fake.navigate('https://suno.com/create')
    fake.play(song)
    runtime.start(on('a'))
    expect(seen).toEqual(['/create', 'Neon Rain'])
  })

  it('stop() shuts everything down', () => {
    const cleanup = vi.fn()
    const fake = fakeHost()
    const catalog: Catalog = {
      plugins: [{ manifest: manifest('a'), module: definePlugin(() => cleanup) }],
      themes: [{ manifest: themeManifest('t'), css: 'body{}' }]
    }
    const runtime = new Runtime({ host: fake.host, catalog })
    runtime.start({ ...on('a'), theme: 't' })
    runtime.stop()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(document.getElementById(THEME_STYLE_ID)).toBeNull()
    fake.navigate('https://suno.com/later')
    expect(runtime.runningPlugins()).toEqual([])
  })
})

describe('Runtime themes', () => {
  const catalog: Catalog = {
    plugins: [],
    themes: [
      {
        manifest: themeManifest('neon', {
          variables: [{ key: 'accent', label: 'Accent', type: 'color', default: '#ff2e97' }]
        }),
        css: '::selection { background: var(--spp-accent) }'
      },
      {
        manifest: themeManifest('create-only', { matches: ['https://suno.com/create*'] }),
        css: 'x{}'
      }
    ]
  }
  const style = () => document.getElementById(THEME_STYLE_ID)

  it('applies, recolors, switches and removes the active theme', () => {
    const runtime = new Runtime({ host: fakeHost().host, catalog })
    runtime.start({ ...EMPTY_STATE, theme: 'neon' })
    expect(style()?.dataset.theme).toBe('neon')
    expect(style()?.textContent).toBe(
      ':root { --spp-accent: #ff2e97; }\n::selection { background: var(--spp-accent) }'
    )
    runtime.setState({
      ...EMPTY_STATE,
      theme: 'neon',
      themeVariables: { neon: { accent: '#00ff00' } }
    })
    expect(style()?.textContent).toContain('--spp-accent: #00ff00;')
    runtime.setState({ ...EMPTY_STATE, theme: 'missing' })
    expect(style()).toBeNull()
    runtime.setState({ ...EMPTY_STATE, theme: null })
    expect(style()).toBeNull()
  })

  it('follows the theme matches and stays last in <head>', () => {
    const fake = fakeHost('https://suno.com/')
    const runtime = new Runtime({ host: fake.host, catalog })
    runtime.start({ ...EMPTY_STATE, theme: 'create-only' })
    expect(style()).toBeNull()
    fake.navigate('https://suno.com/create')
    expect(style()?.dataset.theme).toBe('create-only')
    // Suno adds CSS on navigation; the theme moves back to the end so it still wins.
    document.head.append(document.createElement('link'))
    fake.navigate('https://suno.com/create?x=1')
    expect(document.head.lastElementChild).toBe(style())
    fake.navigate('https://suno.com/library')
    expect(style()).toBeNull()
  })
})

describe('normalizeState', () => {
  it('keeps valid parts and drops junk', () => {
    expect(normalizeState(undefined)).toBe(EMPTY_STATE)
    expect(
      normalizeState({
        enabled: { a: true, b: 'yes' },
        settings: { a: { x: 1 }, b: 5 },
        theme: 7,
        themeVariables: []
      })
    ).toEqual({ enabled: { a: true }, settings: { a: { x: 1 } }, theme: null, themeVariables: {} })
  })
})
