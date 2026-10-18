import type { SettingDefinition, ThemeVariable } from './schema.ts'

export type SettingValue = boolean | string | number
export type SettingsValues = Readonly<Record<string, SettingValue>>

export const HEX_COLOR = /^#[0-9a-f]{6}$/i

function validFor(def: SettingDefinition, value: unknown): value is SettingValue {
  switch (def.type) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'string':
      return typeof value === 'string' && value.length <= def.maxLength
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= (def.min ?? -Infinity) &&
        value <= (def.max ?? Infinity)
      )
    case 'select':
      return typeof value === 'string' && def.options.some((o) => o.value === value)
  }
}

/**
 * Merges stored values over the manifest defaults. Anything missing, of the wrong type or out
 * of range falls back to its default, and keys the manifest no longer declares are dropped, so a
 * plugin always sees exactly the settings it declared.
 */
export function resolveSettings(
  definitions: readonly SettingDefinition[],
  stored: unknown
): SettingsValues {
  const source =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  const out: Record<string, SettingValue> = {}
  for (const def of definitions) {
    const value = source[def.key]
    out[def.key] = validFor(def, value) ? value : def.default
  }
  return Object.freeze(out)
}

export function resolveThemeVariables(
  definitions: readonly ThemeVariable[],
  stored: unknown
): Readonly<Record<string, string>> {
  const source =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const def of definitions) {
    const value = source[def.key]
    out[def.key] = typeof value === 'string' && HEX_COLOR.test(value) ? value : def.default
  }
  return Object.freeze(out)
}

/** `--spp-<key>` custom properties for a theme's variables, e.g. `var(--spp-accent)`. */
export function themeVariablesCss(values: Readonly<Record<string, string>>): string {
  const declarations = Object.entries(values)
    .filter(([, value]) => HEX_COLOR.test(value))
    .map(([key, value]) => `--spp-${key}: ${value};`)
  return declarations.length > 0 ? `:root { ${declarations.join(' ')} }` : ''
}
