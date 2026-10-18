/**
 * Shared, dependency-free pieces of Suno++: URL matching, settings resolution and the manifest
 * types. Validation with zod lives in `@sunoplusplus/core/schema`, used only at build time.
 */
export { SUNO_ORIGIN, isAllowedPattern, matchesUrl } from './match.ts'
export {
  resolveSettings,
  resolveThemeVariables,
  themeVariablesCss,
  type SettingValue,
  type SettingsValues
} from './settings.ts'
export type {
  Author,
  PluginManifest,
  SettingDefinition,
  ThemeManifest,
  ThemeVariable
} from './schema.ts'

/** Version of the plugin API (`PluginContext`). Bump when it changes incompatibly. */
export const API_VERSION = 1

/** Song info, matching `navigator.mediaSession.metadata` and Suno Desktop's bridge payload. */
export interface Song {
  readonly title: string
  readonly artist: string
  readonly album: string
  readonly artwork: readonly {
    readonly src: string
    readonly sizes?: string
    readonly type?: string
  }[]
}

export type PlaybackState = 'none' | 'paused' | 'playing'

export interface Route {
  readonly url: string
  readonly path: string
}
