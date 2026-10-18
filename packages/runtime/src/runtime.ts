import {
  API_VERSION,
  matchesUrl,
  resolveSettings,
  resolveThemeVariables,
  themeVariablesCss,
  type PlaybackState,
  type Route,
  type SettingsValues,
  type Song
} from '@sunoplusplus/core'
import type { Cleanup, Logger, PluginContext, Unsubscribe } from '@sunoplusplus/sdk'
import type { Catalog, CatalogPlugin, CatalogTheme } from './catalog.ts'
import { Emitter, type Host } from './host.ts'
import { EMPTY_STATE, isPluginEnabled, type UserState } from './state.ts'

export const THEME_STYLE_ID = 'sunoplusplus-theme'

function createLogger(scope: string): Logger {
  const prefix = `[Suno++ ${scope}]`
  return {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  }
}

function sameSettings(a: SettingsValues, b: SettingsValues): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

function attachStyle(doc: Document, style: HTMLStyleElement): void {
  // <head> does not exist yet at document_start, whatever the DOM types say.
  const parent = (doc.head as HTMLHeadElement | null) ?? doc.documentElement
  // Last in <head> so a theme or plugin wins over Suno's styles of the same specificity, even
  // after Suno loads more CSS on a client-side navigation.
  if (style.parentNode !== parent || parent.lastElementChild !== style) parent.append(style)
}

interface InstanceDeps {
  readonly host: Host
  readonly doc: Document
  readonly route: () => Route
  readonly song: () => Song | null
  readonly playback: () => PlaybackState
}

/** One running plugin: its context, its listeners and everything to undo when it stops. */
class PluginInstance {
  readonly routes = new Emitter<Route>()
  readonly songs = new Emitter<Song | null>()
  readonly playbacks = new Emitter<PlaybackState>()
  private readonly settingsChanges = new Emitter<SettingsValues>()
  private readonly controller = new AbortController()
  private readonly cleanups: Cleanup[] = []
  private readonly log: Logger
  private readonly plugin: CatalogPlugin
  private readonly deps: InstanceDeps
  private settings: SettingsValues
  private stopped = false

  constructor(plugin: CatalogPlugin, deps: InstanceDeps, settings: SettingsValues) {
    this.plugin = plugin
    this.deps = deps
    this.settings = settings
    this.log = createLogger(plugin.manifest.id)
  }

  start(): void {
    let result: ReturnType<CatalogPlugin['module']['setup']>
    try {
      result = this.plugin.module.setup(this.createContext())
    } catch (error) {
      this.log.error('failed to start', error)
      this.stop()
      return
    }
    if (typeof result === 'function') {
      this.cleanups.push(result)
    } else if (result instanceof Promise) {
      result.then(
        (cleanup) => {
          if (typeof cleanup === 'function') this.onCleanup(cleanup)
        },
        (error: unknown) => {
          this.log.error('failed to start', error)
          this.stop()
        }
      )
    }
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.controller.abort()
    for (const cleanup of this.cleanups.splice(0).reverse()) this.run(cleanup)
  }

  updateSettings(next: SettingsValues): void {
    if (this.stopped || sameSettings(this.settings, next)) return
    this.settings = next
    this.settingsChanges.emit(next)
  }

  private run(fn: () => void): void {
    try {
      fn()
    } catch (error) {
      this.log.error(error)
    }
  }

  private onCleanup(cleanup: Cleanup): void {
    if (this.stopped) this.run(cleanup)
    else this.cleanups.push(cleanup)
  }

  /** Subscribes `listener`, calling it right away with `current` first when given. */
  private listen<T>(
    emitter: Emitter<T>,
    listener: (value: T) => void,
    current?: () => T
  ): Unsubscribe {
    if (this.stopped) return () => undefined
    const safe = (value: T): void => this.run(() => listener(value))
    if (current) safe(current())
    const off = emitter.on(safe)
    this.cleanups.push(off)
    return off
  }

  private createContext(): PluginContext {
    const { deps, plugin } = this
    return Object.freeze<PluginContext>({
      id: plugin.manifest.id,
      env: deps.host.env,
      log: this.log,
      signal: this.controller.signal,
      storage: deps.host.storage(plugin.manifest.id),
      settings: Object.freeze({
        get: (key: string) => {
          const value = this.settings[key]
          if (value === undefined) throw new Error(`"${key}" is not a setting in manifest.json`)
          return value
        },
        all: () => this.settings,
        onChange: (listener: (settings: SettingsValues) => void) =>
          this.listen(this.settingsChanges, listener)
      }),
      onRoute: (listener) => this.listen(this.routes, listener, deps.route),
      onSongChanged: (listener) => this.listen(this.songs, listener, deps.song),
      onPlaybackStateChanged: (listener) => this.listen(this.playbacks, listener, deps.playback),
      addStyle: (css) => {
        if (this.stopped) return () => undefined
        const style = deps.doc.createElement('style')
        style.dataset.sunoplusplusPlugin = plugin.manifest.id
        style.textContent = css
        attachStyle(deps.doc, style)
        const remove = (): void => {
          style.remove()
        }
        this.cleanups.push(remove)
        return remove
      },
      onCleanup: (cleanup) => this.onCleanup(cleanup)
    })
  }
}

export interface RuntimeOptions {
  readonly host: Host
  readonly catalog: Catalog
  readonly document?: Document
}

/**
 * Runs the plugins and the theme the user picked, on the pages their manifests match. Call
 * `start` once, then `setState` whenever the user's choices change: plugins turn on and off live,
 * settings reach running plugins without a restart, and the theme switches without a reload.
 */
export class Runtime {
  private readonly host: Host
  private readonly catalog: Catalog
  private readonly doc: Document
  private readonly instances = new Map<string, PluginInstance>()
  private readonly subscriptions: Unsubscribe[] = []
  private state: UserState = EMPTY_STATE
  private route: Route
  private song: Song | null
  private playback: PlaybackState
  private themeStyle: HTMLStyleElement | null = null
  private started = false
  private domReady = false

  constructor(options: RuntimeOptions) {
    this.host = options.host
    this.catalog = options.catalog
    this.doc = options.document ?? document
    this.route = this.host.currentRoute()
    this.song = this.host.currentSong()
    this.playback = this.host.currentPlayback()
  }

  /** Starts with `state`. Themes apply right away; plugins wait until the DOM is ready. */
  start(state: UserState = this.state): void {
    if (this.started) return
    this.started = true
    this.state = state
    // Read everything now, not in the constructor: the extension creates the runtime at
    // document_start but starts it only after reading storage, and by then the page may have
    // navigated, started a song or finished loading (DOMContentLoaded would never fire again).
    this.route = this.host.currentRoute()
    this.song = this.host.currentSong()
    this.playback = this.host.currentPlayback()
    this.domReady = this.doc.readyState !== 'loading'
    if (!this.domReady) {
      const ready = (): void => {
        this.domReady = true
        this.reconcile()
      }
      this.doc.addEventListener('DOMContentLoaded', ready, { once: true })
      this.subscriptions.push(() => this.doc.removeEventListener('DOMContentLoaded', ready))
    }
    this.subscriptions.push(
      this.host.onRoute((route) => this.onRoute(route)),
      this.host.onSong((song) => {
        this.song = song
        for (const instance of this.instances.values()) instance.songs.emit(song)
      }),
      this.host.onPlayback((playback) => {
        this.playback = playback
        for (const instance of this.instances.values()) instance.playbacks.emit(playback)
      })
    )
    this.reconcile()
  }

  setState(state: UserState): void {
    this.state = state
    if (this.started) this.reconcile()
  }

  /** Stops every plugin and removes the theme. */
  stop(): void {
    for (const off of this.subscriptions.splice(0)) off()
    for (const instance of this.instances.values()) instance.stop()
    this.instances.clear()
    this.themeStyle?.remove()
    this.themeStyle = null
    this.started = false
  }

  /** Ids of the plugins running right now, for tests and debugging. */
  runningPlugins(): string[] {
    return [...this.instances.keys()]
  }

  get apiVersion(): number {
    return API_VERSION
  }

  private onRoute(route: Route): void {
    if (route.url === this.route.url) return
    this.route = route
    const started = this.reconcile()
    // Plugins started by this navigation already got the new route when they subscribed.
    for (const [id, instance] of this.instances) if (!started.has(id)) instance.routes.emit(route)
  }

  private reconcile(): Set<string> {
    const started = new Set<string>()
    for (const plugin of this.catalog.plugins) {
      const { id } = plugin.manifest
      const wanted =
        this.domReady &&
        isPluginEnabled(plugin.manifest, this.state) &&
        matchesUrl(plugin.manifest.matches, this.route.url)
      const running = this.instances.get(id)
      const settings = resolveSettings(plugin.manifest.settings, this.state.settings[id])
      if (wanted && !running) {
        const instance = new PluginInstance(
          plugin,
          {
            host: this.host,
            doc: this.doc,
            route: () => this.route,
            song: () => this.song,
            playback: () => this.playback
          },
          settings
        )
        this.instances.set(id, instance)
        started.add(id)
        instance.start()
      } else if (!wanted && running) {
        this.instances.delete(id)
        running.stop()
      } else if (running) {
        running.updateSettings(settings)
      }
    }
    this.applyTheme()
    return started
  }

  private activeTheme(): CatalogTheme | null {
    const id = this.state.theme
    if (id === null) return null
    const theme = this.catalog.themes.find((t) => t.manifest.id === id)
    return theme && matchesUrl(theme.manifest.matches, this.route.url) ? theme : null
  }

  private applyTheme(): void {
    const theme = this.activeTheme()
    if (!theme) {
      this.themeStyle?.remove()
      this.themeStyle = null
      return
    }
    const variables = resolveThemeVariables(
      theme.manifest.variables,
      this.state.themeVariables[theme.manifest.id]
    )
    const css = `${themeVariablesCss(variables)}\n${theme.css}`
    this.themeStyle ??= this.doc.createElement('style')
    this.themeStyle.id = THEME_STYLE_ID
    this.themeStyle.dataset.theme = theme.manifest.id
    if (this.themeStyle.textContent !== css) this.themeStyle.textContent = css
    attachStyle(this.doc, this.themeStyle)
  }
}
