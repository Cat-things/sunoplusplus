/**
 * The few WebExtension APIs Suno++ uses, typed by hand. Firefox's promise-based `browser` is
 * preferred when present; Chrome's MV3 `chrome` returns promises too.
 */

export interface StorageChange {
  readonly oldValue?: unknown
  readonly newValue?: unknown
}

type ChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void

export interface ExtensionApi {
  readonly storage: {
    readonly local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }
    readonly onChanged: {
      addListener(listener: ChangeListener): void
      removeListener(listener: ChangeListener): void
    }
  }
  readonly runtime: {
    getManifest(): { readonly version: string }
    openOptionsPage(): Promise<void>
  }
}

const scope = globalThis as { browser?: ExtensionApi; chrome?: ExtensionApi }

export function extensionApi(): ExtensionApi {
  const api = scope.browser ?? scope.chrome
  if (!api) throw new Error('Suno++ must run as a browser extension')
  return api
}
