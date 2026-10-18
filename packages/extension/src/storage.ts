import { normalizeState, type UserState } from '@sunoplusplus/runtime'
import type { PluginStorage } from '@sunoplusplus/sdk'
import { extensionApi } from './extension-api.ts'

/** chrome.storage.local key holding the user's choices (see UserState). */
export const STATE_KEY = 'state'

export async function loadState(): Promise<UserState> {
  const items = await extensionApi().storage.local.get(STATE_KEY)
  return normalizeState(items[STATE_KEY])
}

export async function saveState(state: UserState): Promise<void> {
  await extensionApi().storage.local.set({ [STATE_KEY]: state })
}

/** Calls `listener` whenever the state changes, from any tab, popup or options page. */
export function onStateChanged(listener: (state: UserState) => void): () => void {
  const api = extensionApi()
  const handler = (changes: Record<string, { newValue?: unknown }>, area: string): void => {
    const change = changes[STATE_KEY]
    if (area === 'local' && change) listener(normalizeState(change.newValue))
  }
  api.storage.onChanged.addListener(handler)
  return () => api.storage.onChanged.removeListener(handler)
}

/** Per-plugin storage in chrome.storage.local, under `plugin:<id>:<key>`. */
export function pluginStorage(pluginId: string): PluginStorage {
  const prefix = `plugin:${pluginId}:`
  const local = () => extensionApi().storage.local
  return {
    get: async <T>(key: string) => (await local().get(prefix + key))[prefix + key] as T | undefined,
    set: (key, value) => local().set({ [prefix + key]: value }),
    remove: (key) => local().remove(prefix + key)
  }
}
