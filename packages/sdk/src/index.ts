/**
 * The Suno++ plugin SDK. A plugin's index.ts default-exports `definePlugin(setup)`; Suno++ calls
 * `setup` with a `PluginContext` when the plugin is turned on and the page matches its manifest,
 * and cleans everything up when it is turned off or the user leaves those pages.
 *
 *   import { definePlugin } from '@sunoplusplus/sdk'
 *
 *   export default definePlugin((ctx) => {
 *     ctx.onSongChanged((song) => ctx.log.info('now playing', song?.title))
 *   })
 */
import type { PlaybackState, Route, SettingValue, Song } from '@sunoplusplus/core'
import type { Unsubscribe } from './dom.ts'

export type { PlaybackState, Route, SettingValue, Song } from '@sunoplusplus/core'
export { API_VERSION, matchesUrl } from '@sunoplusplus/core'
export * from './dom.ts'

export type Cleanup = () => void

/** What `setup` may return: nothing, a cleanup function, or a promise of either. */
export type SetupResult = Cleanup | undefined | Promise<Cleanup | undefined>

export interface Environment {
  /** `extension` in a browser, `desktop` inside Suno Desktop. */
  readonly kind: 'extension' | 'desktop'
  /** Suno Desktop's version, only when `kind` is `desktop`. */
  readonly desktopVersion?: string
  /** Version of this API. */
  readonly apiVersion: number
}

export interface Logger {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

/** Settings declared in manifest.json, with the user's choices applied. */
export interface PluginSettings<S> {
  get<K extends keyof S>(key: K): S[K]
  all(): Readonly<S>
  /** Called with all settings whenever the user changes one. */
  onChange(listener: (settings: Readonly<S>) => void): Unsubscribe
}

/** Small per-plugin key/value storage. Values must be JSON-serializable. */
export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

export type SettingsShape<S> = { readonly [K in keyof S]: SettingValue }

export interface PluginContext<S extends SettingsShape<S> = Record<string, SettingValue>> {
  /** The plugin's id from manifest.json. */
  readonly id: string
  readonly env: Environment
  /** Console logging, prefixed with the plugin id. */
  readonly log: Logger
  readonly settings: PluginSettings<S>
  readonly storage: PluginStorage
  /**
   * Aborted when the plugin stops. Pass it to `addEventListener`, `fetch` and the DOM helpers
   * and they clean up by themselves.
   */
  readonly signal: AbortSignal
  /** Called right away with the current page, then on every navigation. */
  onRoute(listener: (route: Route) => void): Unsubscribe
  /** Called right away with the current song (or null), then whenever it changes. */
  onSongChanged(listener: (song: Song | null) => void): Unsubscribe
  /** Called right away with the current state, then whenever playback starts, pauses or stops. */
  onPlaybackStateChanged(listener: (state: PlaybackState) => void): Unsubscribe
  /** Adds CSS to the page while the plugin runs. */
  addStyle(css: string): Unsubscribe
  /** Runs `cleanup` when the plugin stops. */
  onCleanup(cleanup: Cleanup): void
}

export interface PluginModule<S extends SettingsShape<S> = Record<string, SettingValue>> {
  readonly kind: 'sunoplusplus.plugin'
  // Method syntax on purpose: lets a plugin typed with its own settings sit in the catalog.
  setup(ctx: PluginContext<S>): SetupResult
}

/**
 * Declares a plugin. `setup` may return a cleanup function; anything registered through `ctx`
 * is cleaned up automatically either way. Pass your settings type for typed `ctx.settings`:
 *
 *   definePlugin<{ showArtist: boolean }>((ctx) => { ctx.settings.get('showArtist') })
 */
export function definePlugin<S extends SettingsShape<S> = Record<string, SettingValue>>(
  setup: (ctx: PluginContext<S>) => SetupResult
): PluginModule<S> {
  return Object.freeze({ kind: 'sunoplusplus.plugin', setup })
}
