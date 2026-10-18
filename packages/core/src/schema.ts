/**
 * Manifest formats for Suno++ plugins and themes, validated at build time (scripts/validate.ts)
 * and exported as JSON Schema for editors. The runtime never imports this file, so zod stays
 * out of the content script; it receives manifests that already passed these checks.
 */
import { z } from 'zod'
import { isAllowedPattern } from './match.ts'
import { HEX_COLOR } from './settings.ts'

export const MANIFEST_VERSION = 1

/** Licenses that can ship inside the MIT-licensed bundle. */
export const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0'
] as const

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
const SETTING_KEY = /^[a-z][a-zA-Z0-9]{0,39}$/
const VARIABLE_KEY = /^[a-z][a-z0-9-]{0,39}$/

const id = z
  .string()
  .min(3)
  .max(48)
  .regex(ID, 'use lowercase letters, digits and single dashes, e.g. "style-helper"')

const text = (max: number) => z.string().trim().min(1).max(max)

const author = z.strictObject({
  name: text(80),
  github: z.string().regex(GITHUB_USER, 'must be a GitHub username').optional()
})

const matches = z
  .array(
    z.string().refine(isAllowedPattern, {
      message:
        'patterns must start with "https://suno.com/" (other sites and sign-in pages are off limits)'
    })
  )
  .min(1)
  .max(20)
  .default(['https://suno.com/*'])

const common = {
  $schema: z.string().optional(),
  manifestVersion: z.literal(MANIFEST_VERSION),
  id,
  name: text(48),
  description: text(200),
  version: z.string().regex(SEMVER, 'use a plain x.y.z version, e.g. "1.0.0"'),
  authors: z.array(author).min(1).max(10),
  license: z.enum(ALLOWED_LICENSES, {
    message: `must be one of ${ALLOWED_LICENSES.join(', ')}`
  }),
  tags: z.array(z.string().regex(ID).max(24)).max(8).default([]),
  matches
}

const settingBase = {
  key: z.string().regex(SETTING_KEY, 'use camelCase, e.g. "showArtist"'),
  label: text(60),
  description: text(200).optional()
}

const setting = z.discriminatedUnion('type', [
  z.strictObject({ ...settingBase, type: z.literal('boolean'), default: z.boolean() }),
  z
    .strictObject({
      ...settingBase,
      type: z.literal('string'),
      default: z.string(),
      maxLength: z.int().min(1).max(1000).default(200),
      placeholder: z.string().max(100).optional()
    })
    .refine((s) => s.default.length <= s.maxLength, {
      message: 'default is longer than maxLength',
      path: ['default']
    }),
  z
    .strictObject({
      ...settingBase,
      type: z.literal('number'),
      default: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().positive().optional()
    })
    .refine((s) => (s.min ?? -Infinity) <= s.default && s.default <= (s.max ?? Infinity), {
      message: 'default is outside min/max',
      path: ['default']
    }),
  z
    .strictObject({
      ...settingBase,
      type: z.literal('select'),
      default: z.string(),
      options: z
        .array(z.strictObject({ value: z.string().min(1).max(60), label: text(60) }))
        .min(2)
        .max(30)
    })
    .refine((s) => s.options.some((o) => o.value === s.default), {
      message: 'default must be one of the option values',
      path: ['default']
    })
])

function uniqueBy<T>(key: (item: T) => string, what: string) {
  return (items: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const k = key(item)
      if (seen.has(k))
        ctx.addIssue({ code: 'custom', message: `duplicate ${what} "${k}"`, path: [index] })
      seen.add(k)
    })
  }
}

export const pluginManifestSchema = z.strictObject({
  ...common,
  world: z
    .literal('isolated', {
      message: 'only "isolated" is supported for now; plugins cannot run in the page\'s own world'
    })
    .default('isolated'),
  enabledByDefault: z.boolean().default(false),
  settings: z
    .array(setting)
    .max(30)
    .default([])
    .superRefine(uniqueBy((s) => s.key, 'setting key'))
})

const themeVariable = z.strictObject({
  key: z.string().regex(VARIABLE_KEY, 'use lowercase and dashes, e.g. "accent"'),
  label: text(60),
  type: z.literal('color'),
  default: z.string().regex(HEX_COLOR, 'use a #rrggbb color')
})

export const themeManifestSchema = z.strictObject({
  ...common,
  appearance: z.enum(['dark', 'light', 'any']).default('any'),
  variables: z
    .array(themeVariable)
    .max(20)
    .default([])
    .superRefine(uniqueBy((v) => v.key, 'variable key'))
})

export type PluginManifest = z.output<typeof pluginManifestSchema>
export type ThemeManifest = z.output<typeof themeManifestSchema>
export type SettingDefinition = PluginManifest['settings'][number]
export type ThemeVariable = ThemeManifest['variables'][number]
export type Author = PluginManifest['authors'][number]

export type ParseResult<T> = { ok: true; manifest: T } | { ok: false; errors: string[] }

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.reduce<string>(
      (acc, part) =>
        typeof part === 'number'
          ? `${acc}[${part}]`
          : acc
            ? `${acc}.${String(part)}`
            : String(part),
      ''
    )
    return where ? `${where}: ${issue.message}` : issue.message
  })
}

export function parsePluginManifest(input: unknown): ParseResult<PluginManifest> {
  const result = pluginManifestSchema.safeParse(input)
  return result.success
    ? { ok: true, manifest: result.data }
    : { ok: false, errors: formatIssues(result.error) }
}

export function parseThemeManifest(input: unknown): ParseResult<ThemeManifest> {
  const result = themeManifestSchema.safeParse(input)
  return result.success
    ? { ok: true, manifest: result.data }
    : { ok: false, errors: formatIssues(result.error) }
}

/** JSON Schemas for `$schema` in manifest.json, so editors autocomplete and flag mistakes. */
export function manifestJsonSchemas(): { plugin: unknown; theme: unknown } {
  return {
    plugin: z.toJSONSchema(pluginManifestSchema, { io: 'input', unrepresentable: 'any' }),
    theme: z.toJSONSchema(themeManifestSchema, { io: 'input', unrepresentable: 'any' })
  }
}
