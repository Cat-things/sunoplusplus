import type { PlaybackState, Route, Song } from '@sunoplusplus/core'
import type { Environment, PluginStorage, Unsubscribe } from '@sunoplusplus/sdk'

/**
 * What the runtime needs from where it runs. The browser extension and Suno Desktop each provide
 * one; tests use a fake. Hosts only report what happens on the page; the runtime decides what to
 * run.
 */
export interface Host {
  readonly env: Environment
  currentRoute(): Route
  onRoute(listener: (route: Route) => void): Unsubscribe
  currentSong(): Song | null
  onSong(listener: (song: Song | null) => void): Unsubscribe
  currentPlayback(): PlaybackState
  onPlayback(listener: (state: PlaybackState) => void): Unsubscribe
  /** Storage for one plugin, namespaced by its id. */
  storage(pluginId: string): PluginStorage
}

/** Minimal synchronous event emitter. Listener errors are reported, never rethrown. */
export class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>()

  on(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      // A listener removed by an earlier one during this emit must not run.
      if (!this.listeners.has(listener)) continue
      try {
        listener(value)
      } catch (error) {
        console.error('[Suno++]', error)
      }
    }
  }

  get size(): number {
    return this.listeners.size
  }
}

export function routeOf(href: string): Route {
  const url = new URL(href)
  return Object.freeze({ url: url.href, path: `${url.pathname}${url.search}` })
}

function sameArtwork(a: Song['artwork'], b: Song['artwork']): boolean {
  return a.length === b.length && a.every((art, i) => art.src === b[i]?.src)
}

export function sameSong(a: Song | null, b: Song | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    sameArtwork(a.artwork, b.artwork)
  )
}

/** Reads `navigator.mediaSession.metadata` (shared by all JavaScript worlds of the page). */
export function readMediaSessionSong(): Song | null {
  const metadata = typeof navigator === 'undefined' ? null : navigator.mediaSession.metadata
  if (!metadata || (!metadata.title && !metadata.artist)) return null
  return Object.freeze({
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    artwork: Object.freeze(
      [...metadata.artwork].map((art) =>
        Object.freeze({
          src: art.src,
          ...(art.sizes ? { sizes: art.sizes } : {}),
          ...(art.type ? { type: art.type } : {})
        })
      )
    )
  })
}

/** In-memory storage, used in tests and when nothing better exists. */
export function memoryStorage(): PluginStorage {
  const data = new Map<string, string>()
  return {
    get: <T>(key: string) => {
      const raw = data.get(key)
      return Promise.resolve(raw === undefined ? undefined : (JSON.parse(raw) as T))
    },
    set: (key, value) => {
      data.set(key, JSON.stringify(value))
      return Promise.resolve()
    },
    remove: (key) => {
      data.delete(key)
      return Promise.resolve()
    }
  }
}
