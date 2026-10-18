import type { PluginManifest, ThemeManifest } from '@sunoplusplus/core'
import type { PluginModule } from '@sunoplusplus/sdk'

/** Everything bundled into a build: validated manifests plus plugin code and theme CSS. */
export interface CatalogPlugin {
  readonly manifest: PluginManifest
  readonly module: PluginModule
}

export interface CatalogTheme {
  readonly manifest: ThemeManifest
  readonly css: string
}

export interface Catalog {
  readonly plugins: readonly CatalogPlugin[]
  readonly themes: readonly CatalogTheme[]
}

/** Manifests only, for settings pages that list plugins and themes without running them. */
export interface CatalogMeta {
  readonly plugins: readonly { readonly manifest: PluginManifest }[]
  readonly themes: readonly { readonly manifest: ThemeManifest }[]
}
