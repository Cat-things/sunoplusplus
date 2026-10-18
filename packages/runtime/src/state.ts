import type { PluginManifest } from '@sunoplusplus/core'

/**
 * The user's choices. Stored by the extension in `chrome.storage.local` under `state`, and
 * owned by Suno Desktop on the desktop. Settings and theme colors are stored raw and resolved
 * against the manifests at use, so a plugin update that changes its settings never breaks.
 */
export interface UserState {
  /** Plugin id → on/off. Missing means the manifest's `enabledByDefault`. */
  readonly enabled: Readonly<Record<string, boolean>>
  /** Plugin id → setting key → value. */
  readonly settings: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** Active theme id, or null for Suno's own look. */
  readonly theme: string | null
  /** Theme id → variable key → color. */
  readonly themeVariables: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

export const EMPTY_STATE: UserState = Object.freeze({
  enabled: Object.freeze({}),
  settings: Object.freeze({}),
  theme: null,
  themeVariables: Object.freeze({})
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordOfRecords(value: unknown): Record<string, Record<string, unknown>> {
  if (!isRecord(value)) return {}
  const out: Record<string, Record<string, unknown>> = {}
  for (const [key, inner] of Object.entries(value)) if (isRecord(inner)) out[key] = { ...inner }
  return out
}

/** Turns whatever was stored (possibly nothing, possibly junk) into a valid state. */
export function normalizeState(input: unknown): UserState {
  if (!isRecord(input)) return EMPTY_STATE
  const enabled: Record<string, boolean> = {}
  if (isRecord(input.enabled)) {
    for (const [id, on] of Object.entries(input.enabled))
      if (typeof on === 'boolean') enabled[id] = on
  }
  return {
    enabled,
    settings: recordOfRecords(input.settings),
    theme: typeof input.theme === 'string' ? input.theme : null,
    themeVariables: recordOfRecords(input.themeVariables)
  }
}

export function isPluginEnabled(manifest: PluginManifest, state: UserState): boolean {
  return state.enabled[manifest.id] ?? manifest.enabledByDefault
}
