/**
 * Suno++ inside Suno Desktop. The app registers this bundle with its injection pipeline in the
 * isolated plugin world, prefixed with the user's choices:
 *
 *   globalThis.__SUNOPLUSPLUS_DESKTOP__ = { state: { enabled, settings, theme, themeVariables } }
 *
 * Suno Desktop owns that state (its Settings window shows the plugins from catalog.json). When it
 * changes, the app runs the bundle again with the new config, and this updates the runtime that
 * is already on the page instead of starting a second one. When the app has downloaded a newer
 * Suno++, the new bundle stops the old runtime and takes over, without reloading the page (so the
 * music keeps playing). See docs/DESKTOP.md.
 */
import { catalog } from 'sunoplusplus:catalog'
import {
  Runtime,
  createDesktopHost,
  getDesktopBridge,
  localStoragePluginStorage,
  normalizeState
} from '@sunoplusplus/runtime'

declare const __SUNOPLUSPLUS_VERSION__: string

const CONFIG_KEY = '__SUNOPLUSPLUS_DESKTOP__'
const RUNTIME_KEY = Symbol.for('sunoplusplus.runtime')

/** What a run of this bundle leaves on the page for the next run to find. */
interface Installed {
  readonly version: string
  readonly runtime: Pick<Runtime, 'setState' | 'stop'>
  readonly dispose: () => void
  /** The song and playback state right now, handed to a newer version when it takes over. */
  readonly current: () => { readonly song: unknown; readonly playback: unknown }
}

const scope = globalThis as Record<PropertyKey, unknown>
const config = scope[CONFIG_KEY] as { state?: unknown } | undefined
const state = normalizeState(config?.state)
// Each run of the bundle defines its own classes, so `instanceof` can't recognise a previous
// run's runtime; compare versions instead.
const existing = scope[RUNTIME_KEY] as Partial<Installed> | undefined

if (existing?.version === __SUNOPLUSPLUS_VERSION__ && existing.runtime) {
  existing.runtime.setState(state)
} else {
  let handover: { song?: unknown; playback?: unknown } | undefined
  if (existing) {
    try {
      handover = existing.current?.()
      existing.runtime?.stop()
      existing.dispose?.()
    } catch (error) {
      console.error('[Suno++] could not stop the previous version', error)
    }
    scope[RUNTIME_KEY] = undefined
  }
  const bridge = getDesktopBridge()
  if (bridge) {
    const host = createDesktopHost(bridge, localStoragePluginStorage, handover)
    const runtime = new Runtime({ host, catalog })
    const installed: Installed = {
      version: __SUNOPLUSPLUS_VERSION__,
      runtime,
      dispose: () => host.dispose(),
      current: () => ({ song: host.currentSong(), playback: host.currentPlayback() })
    }
    scope[RUNTIME_KEY] = installed
    runtime.start(state)
  } else {
    console.warn('[Suno++] Suno Desktop bridge not found (needs Suno Desktop with bridge API 1+)')
  }
}
