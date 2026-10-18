import { API_VERSION, type PlaybackState, type Route, type Song } from '@sunoplusplus/core'
import type { PluginStorage } from '@sunoplusplus/sdk'
import { Emitter, readMediaSessionSong, routeOf, sameSong, type Host } from './host.ts'

/**
 * The part of Suno Desktop's `window.sunoDesktop` bridge Suno++ uses (bridge API version 1).
 * See https://github.com/Cat-things/suno-desktop/blob/main/docs/PLUGIN_HOOKS.md
 */
export interface SunoDesktopBridge {
  readonly version: string
  readonly apiVersion: number
  readonly capabilities: readonly string[]
  on(event: 'routeChanged', listener: (payload: { url: string; path: string }) => void): () => void
  on(event: 'songChanged', listener: (payload: unknown) => void): () => void
  on(
    event: 'playbackStateChanged',
    listener: (payload: { state: PlaybackState }) => void
  ): () => void
}

const REQUIRED_CAPABILITIES = [
  'desktop',
  'events.routeChanged',
  'events.songChanged',
  'events.playbackStateChanged'
]

/** Returns Suno Desktop's bridge when running inside the app (version 1 or newer), else null. */
export function getDesktopBridge(scope: object = globalThis): SunoDesktopBridge | null {
  const bridge = (scope as { sunoDesktop?: Partial<SunoDesktopBridge> }).sunoDesktop
  if (typeof bridge !== 'object' || typeof bridge.on !== 'function') return null
  if (typeof bridge.apiVersion !== 'number' || bridge.apiVersion < 1) return null
  const capabilities = bridge.capabilities
  if (!Array.isArray(capabilities)) return null
  return REQUIRED_CAPABILITIES.every((c) => capabilities.includes(c))
    ? (bridge as SunoDesktopBridge)
    : null
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Validates a bridge payload into a frozen Song instead of trusting its shape. */
export function toSong(payload: unknown): Song | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (!text(p.title) && !text(p.artist)) return null
  const artwork = (Array.isArray(p.artwork) ? (p.artwork as unknown[]) : []).flatMap((art) => {
    if (typeof art !== 'object' || art === null) return []
    const a = art as Record<string, unknown>
    if (typeof a.src !== 'string') return []
    return [
      Object.freeze({
        src: a.src,
        ...(typeof a.sizes === 'string' ? { sizes: a.sizes } : {}),
        ...(typeof a.type === 'string' ? { type: a.type } : {})
      })
    ]
  })
  return Object.freeze({
    title: text(p.title),
    artist: text(p.artist),
    album: text(p.album),
    artwork: Object.freeze(artwork)
  })
}

function isPlaybackState(value: unknown): value is PlaybackState {
  return value === 'none' || value === 'paused' || value === 'playing'
}

function initialPlayback(): PlaybackState {
  const declared = navigator.mediaSession.playbackState
  return declared === 'playing' || declared === 'paused' ? declared : 'none'
}

/**
 * Host for Suno Desktop. The app already tracks routes and media in the page world (including
 * audio that never enters the DOM), so this just listens to its bridge.
 */
export function createDesktopHost(
  bridge: SunoDesktopBridge,
  storage: (pluginId: string) => PluginStorage,
  /**
   * What a previous Suno++ version on this page last saw. The bridge doesn't replay events, so
   * without this an update would forget the song that's already playing.
   */
  handover?: { readonly song?: unknown; readonly playback?: unknown }
): Host & { dispose(): void } {
  const routes = new Emitter<Route>()
  const songs = new Emitter<Song | null>()
  const playbacks = new Emitter<PlaybackState>()
  let route = routeOf(location.href)
  let song = toSong(handover?.song) ?? readMediaSessionSong()
  let playback = isPlaybackState(handover?.playback) ? handover.playback : initialPlayback()

  const offs = [
    bridge.on('routeChanged', ({ url }) => {
      if (url === route.url) return
      route = routeOf(url)
      routes.emit(route)
    }),
    bridge.on('songChanged', (payload) => {
      const next = toSong(payload)
      if (sameSong(song, next)) return
      song = next
      songs.emit(song)
    }),
    bridge.on('playbackStateChanged', ({ state }) => {
      if (state === playback) return
      playback = state
      playbacks.emit(playback)
    })
  ]

  return {
    env: Object.freeze({
      kind: 'desktop',
      desktopVersion: bridge.version,
      apiVersion: API_VERSION
    }),
    currentRoute: () => route,
    onRoute: (listener) => routes.on(listener),
    currentSong: () => song,
    onSong: (listener) => songs.on(listener),
    currentPlayback: () => playback,
    onPlayback: (listener) => playbacks.on(listener),
    storage,
    dispose: () => {
      for (const off of offs) off()
    }
  }
}

/** Plugin storage in suno.com's localStorage, namespaced per plugin. Used on the desktop. */
export function localStoragePluginStorage(pluginId: string): PluginStorage {
  const prefix = `sunoplusplus:plugin:${pluginId}:`
  return {
    get: <T>(key: string) => {
      const raw = localStorage.getItem(prefix + key)
      if (raw === null) return Promise.resolve(undefined)
      try {
        return Promise.resolve(JSON.parse(raw) as T)
      } catch {
        return Promise.resolve(undefined)
      }
    },
    set: (key, value) => {
      localStorage.setItem(prefix + key, JSON.stringify(value))
      return Promise.resolve()
    },
    remove: (key) => {
      localStorage.removeItem(prefix + key)
      return Promise.resolve()
    }
  }
}
