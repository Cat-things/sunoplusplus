/**
 * Suno++ inside Suno Desktop. The app registers this bundle with its injection pipeline in the
 * isolated plugin world, prefixed with the user's choices:
 *
 *   globalThis.__SUNOPLUSPLUS_DESKTOP__ = { state: { enabled, settings, theme, themeVariables } }
 *
 * Suno Desktop owns that state (its Settings window shows the plugins from catalog.json). When it
 * changes, the app runs the bundle again with the new config, and this updates the runtime that
 * is already on the page instead of starting a second one. See docs/DESKTOP.md.
 */
import { catalog } from 'sunoplusplus:catalog'
import {
  Runtime,
  createDesktopHost,
  getDesktopBridge,
  localStoragePluginStorage,
  normalizeState
} from '@sunoplusplus/runtime'

const CONFIG_KEY = '__SUNOPLUSPLUS_DESKTOP__'
const RUNTIME_KEY = Symbol.for('sunoplusplus.runtime')

const scope = globalThis as Record<PropertyKey, unknown>
const config = scope[CONFIG_KEY] as { state?: unknown } | undefined
const state = normalizeState(config?.state)
// Each run of the bundle defines its own Runtime class, so `instanceof` would never match the
// runtime a previous run left on the page.
const existing = scope[RUNTIME_KEY] as Pick<Runtime, 'setState'> | undefined

if (typeof existing?.setState === 'function') {
  existing.setState(state)
} else {
  const bridge = getDesktopBridge()
  if (bridge) {
    const runtime = new Runtime({
      host: createDesktopHost(bridge, localStoragePluginStorage),
      catalog
    })
    scope[RUNTIME_KEY] = runtime
    runtime.start(state)
  } else {
    console.warn('[Suno++] Suno Desktop bridge not found (needs Suno Desktop with bridge API 1+)')
  }
}
