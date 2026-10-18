import { API_VERSION, type PlaybackState, type Route, type Song } from '@sunoplusplus/core'
import type { PluginStorage } from '@sunoplusplus/sdk'
import { Emitter, readMediaSessionSong, routeOf, sameSong, type Host } from './host.ts'

/**
 * Event the extension's page-world media probe dispatches on `document` with the playback state
 * of media elements the isolated world cannot see (Suno plays through `new Audio()`, which never
 * enters the DOM). See packages/extension/src/media-probe.ts.
 */
export const MEDIA_PROBE_EVENT = 'sunoplusplus:media'

export interface BrowserHostOptions {
  readonly storage: (pluginId: string) => PluginStorage
  /** How often to check the URL and the media session, in ms. */
  readonly pollMs?: number
}

function isPlaybackState(value: unknown): value is PlaybackState {
  return value === 'none' || value === 'paused' || value === 'playing'
}

/**
 * Host for the browser extension's content script (an isolated world). It watches the page
 * itself: the Navigation API, popstate and hashchange for client-side routing, with a cheap URL
 * poll as a safety net, and the media session (plus the probe) for songs and playback.
 */
export function createBrowserHost(options: BrowserHostOptions): Host & { dispose(): void } {
  const routes = new Emitter<Route>()
  const songs = new Emitter<Song | null>()
  const playbacks = new Emitter<PlaybackState>()
  let route = routeOf(location.href)
  let song = readMediaSessionSong()
  let probed: PlaybackState = 'none'

  const readPlayback = (): PlaybackState => {
    const declared = navigator.mediaSession.playbackState
    if (declared === 'playing' || declared === 'paused') return declared
    if (probed !== 'none') return probed
    const media = [...document.querySelectorAll<HTMLMediaElement>('audio, video')]
    if (media.some((m) => !m.paused && !m.ended)) return 'playing'
    return media.some((m) => m.currentSrc) ? 'paused' : 'none'
  }
  let playback = readPlayback()

  const checkRoute = (): void => {
    if (location.href === route.url) return
    route = routeOf(location.href)
    routes.emit(route)
  }
  const checkMedia = (): void => {
    const nextSong = readMediaSessionSong()
    if (!sameSong(song, nextSong)) {
      song = nextSong
      songs.emit(song)
    }
    const nextPlayback = readPlayback()
    if (nextPlayback !== playback) {
      playback = nextPlayback
      playbacks.emit(playback)
    }
  }
  const onProbe = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail
    if (!isPlaybackState(detail)) return
    probed = detail
    checkMedia()
  }

  const controller = new AbortController()
  const { signal } = controller
  const navigation = (globalThis as { navigation?: EventTarget }).navigation
  navigation?.addEventListener('currententrychange', checkRoute, { signal })
  addEventListener('popstate', checkRoute, { signal })
  addEventListener('hashchange', checkRoute, { signal })
  document.addEventListener(MEDIA_PROBE_EVENT, onProbe, { signal })
  for (const type of ['play', 'playing', 'pause', 'ended', 'emptied']) {
    document.addEventListener(type, checkMedia, { capture: true, signal })
  }
  const timer = setInterval(() => {
    checkRoute()
    checkMedia()
  }, options.pollMs ?? 500)

  return {
    env: Object.freeze({ kind: 'extension', apiVersion: API_VERSION }),
    currentRoute: () => route,
    onRoute: (listener) => routes.on(listener),
    currentSong: () => song,
    onSong: (listener) => songs.on(listener),
    currentPlayback: () => playback,
    onPlayback: (listener) => playbacks.on(listener),
    storage: options.storage,
    dispose: () => {
      controller.abort()
      clearInterval(timer)
    }
  }
}
