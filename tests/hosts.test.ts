import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackState, Song } from '@sunoplusplus/core'
import {
  MEDIA_PROBE_EVENT,
  createBrowserHost,
  createDesktopHost,
  getDesktopBridge,
  localStoragePluginStorage,
  toSong,
  memoryStorage,
  type SunoDesktopBridge
} from '@sunoplusplus/runtime'

type Metadata = { title: string; artist: string; album: string; artwork: { src: string }[] } | null

let metadata: Metadata = null
let declared: 'none' | 'paused' | 'playing' = 'none'

beforeEach(() => {
  metadata = null
  declared = 'none'
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: {
      get metadata() {
        return metadata
      },
      get playbackState() {
        return declared
      }
    }
  })
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
  localStorage.clear()
})

describe('browser host', () => {
  it('reports client-side navigation once per URL', () => {
    vi.useFakeTimers()
    const host = createBrowserHost({ storage: () => memoryStorage(), pollMs: 100 })
    const paths: string[] = []
    host.onRoute((r) => paths.push(r.path))
    expect(host.currentRoute().path).toBe('/')
    history.pushState(null, '', '/create')
    vi.advanceTimersByTime(100)
    vi.advanceTimersByTime(100)
    dispatchEvent(new PopStateEvent('popstate'))
    history.pushState(null, '', '/song/abc?x=1')
    dispatchEvent(new PopStateEvent('popstate'))
    expect(paths).toEqual(['/create', '/song/abc?x=1'])
    host.dispose()
    history.pushState(null, '', '/after')
    vi.advanceTimersByTime(500)
    expect(paths).toHaveLength(2)
  })

  it('reads songs from the media session and playback from the session, probe or DOM', () => {
    vi.useFakeTimers()
    const host = createBrowserHost({ storage: () => memoryStorage(), pollMs: 100 })
    const songs: (string | null)[] = []
    const states: PlaybackState[] = []
    host.onSong((s) => songs.push(s?.title ?? null))
    host.onPlayback((s) => states.push(s))

    metadata = {
      title: 'Neon Rain',
      artist: 'Cat',
      album: '',
      artwork: [{ src: 'https://cdn1.suno.ai/a.jpg' }]
    }
    declared = 'playing'
    vi.advanceTimersByTime(100)
    vi.advanceTimersByTime(100) // unchanged: no repeat
    expect(host.currentSong()).toEqual({
      title: 'Neon Rain',
      artist: 'Cat',
      album: '',
      artwork: [{ src: 'https://cdn1.suno.ai/a.jpg' }]
    })

    declared = 'none'
    document.dispatchEvent(new CustomEvent(MEDIA_PROBE_EVENT, { detail: 'paused' }))
    document.dispatchEvent(new CustomEvent(MEDIA_PROBE_EVENT, { detail: 'bogus' }))
    metadata = null
    vi.advanceTimersByTime(100)
    expect(songs).toEqual(['Neon Rain', null])
    expect(states).toEqual(['playing', 'paused'])
    host.dispose()
  })

  it('identifies itself as the extension', () => {
    const host = createBrowserHost({ storage: () => memoryStorage() })
    expect(host.env).toEqual({ kind: 'extension', apiVersion: 1 })
    host.dispose()
  })
})

function fakeBridge(extra: Partial<SunoDesktopBridge> = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const bridge = {
    version: '0.1.1',
    apiVersion: 1,
    platform: 'win32',
    capabilities: [
      'desktop',
      'events.routeChanged',
      'events.songChanged',
      'events.playbackStateChanged'
    ],
    on(event: string, listener: (payload: unknown) => void) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
      return () => set.delete(listener)
    },
    ...extra
  } as unknown as SunoDesktopBridge
  return {
    bridge,
    emit: (event: string, payload: unknown) => {
      for (const l of listeners.get(event) ?? []) l(payload)
    }
  }
}

describe('desktop host', () => {
  it('detects Suno Desktop by its bridge and capabilities', () => {
    expect(getDesktopBridge({})).toBeNull()
    expect(getDesktopBridge({ sunoDesktop: fakeBridge().bridge })).not.toBeNull()
    expect(getDesktopBridge({ sunoDesktop: fakeBridge({ apiVersion: 0 }).bridge })).toBeNull()
    expect(
      getDesktopBridge({ sunoDesktop: fakeBridge({ capabilities: ['desktop'] }).bridge })
    ).toBeNull()
  })

  it('relays bridge events, deduplicated', () => {
    const { bridge, emit } = fakeBridge()
    const host = createDesktopHost(bridge, () => memoryStorage())
    expect(host.env).toEqual({ kind: 'desktop', desktopVersion: '0.1.1', apiVersion: 1 })
    const seen: unknown[] = []
    host.onRoute((r) => seen.push(r.path))
    host.onSong((s) => seen.push(s?.title ?? null))
    host.onPlayback((s) => seen.push(s))
    emit('routeChanged', { url: 'https://suno.com/', path: '/' }) // same as current
    emit('routeChanged', { url: 'https://suno.com/create', path: '/create' })
    const song: Song = { title: 'Neon Rain', artist: 'Cat', album: '', artwork: [] }
    emit('songChanged', song)
    emit('songChanged', { ...song })
    emit('playbackStateChanged', { state: 'playing' })
    emit('playbackStateChanged', { state: 'playing' })
    expect(seen).toEqual(['/create', 'Neon Rain', 'playing'])
    expect(Object.isFrozen(host.currentSong())).toBe(true)
    host.dispose()
    emit('routeChanged', { url: 'https://suno.com/x', path: '/x' })
    expect(seen).toHaveLength(3)
  })

  it('starts from what a previous version handed over, validated', () => {
    const { bridge } = fakeBridge()
    const host = createDesktopHost(bridge, () => memoryStorage(), {
      song: { title: 'Still Playing', artist: 'Cat', album: '', artwork: [] },
      playback: 'playing'
    })
    expect(host.currentSong()?.title).toBe('Still Playing')
    expect(host.currentPlayback()).toBe('playing')
    const junk = createDesktopHost(bridge, () => memoryStorage(), { song: 5, playback: 'loud' })
    expect(junk.currentSong()).toBeNull()
    expect(junk.currentPlayback()).toBe('none')
  })

  it('validates song payloads instead of trusting them', () => {
    expect(toSong(null)).toBeNull()
    expect(toSong({ title: '', artist: '' })).toBeNull()
    expect(
      toSong({ title: 'T', artist: 5, artwork: [{ src: 'a.jpg', sizes: 1 }, { nope: true }, 'x'] })
    ).toEqual({ title: 'T', artist: '', album: '', artwork: [{ src: 'a.jpg' }] })
  })

  it('keeps plugin storage namespaced in localStorage', async () => {
    const a = localStoragePluginStorage('a')
    await a.set('count', { n: 2 })
    expect(localStorage.getItem('sunoplusplus:plugin:a:count')).toBe('{"n":2}')
    expect(await localStoragePluginStorage('b').get('count')).toBeUndefined()
    expect(await a.get('count')).toEqual({ n: 2 })
    localStorage.setItem('sunoplusplus:plugin:a:broken', '{')
    expect(await a.get('broken')).toBeUndefined()
    await a.remove('count')
    expect(await a.get('count')).toBeUndefined()
  })
})
