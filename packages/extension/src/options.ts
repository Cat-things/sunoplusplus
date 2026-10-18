/**
 * The popup and the options page (same code; the popup is a compact layout). Lists the bundled
 * plugins and themes, renders each plugin's settings from its manifest, and saves the user's
 * choices, which open Suno tabs pick up right away.
 */
import { catalog } from 'sunoplusplus:catalog-meta'
import {
  resolveSettings,
  resolveThemeVariables,
  type Author,
  type PluginManifest,
  type SettingDefinition,
  type SettingValue,
  type ThemeManifest
} from '@sunoplusplus/core'
import { EMPTY_STATE, isPluginEnabled, type UserState } from '@sunoplusplus/runtime'
import { el } from '@sunoplusplus/sdk'
import { extensionApi } from './extension-api.ts'
import { loadState, onStateChanged, saveState } from './storage.ts'

const REPO = 'https://github.com/Cat-things/sunoplusplus'
const APPEARANCE: Record<ThemeManifest['appearance'], string> = {
  dark: 'Dark',
  light: 'Light',
  any: 'Light & dark'
}

const app = document.getElementById('app') ?? document.body
const popup = document.body.classList.contains('popup')
let state: UserState = EMPTY_STATE
let savedJson = ''

/** Applies a change, saves it, and re-renders when the layout depends on it. */
function commit(change: (current: UserState) => UserState, rerender: boolean): void {
  state = change(state)
  savedJson = JSON.stringify(state)
  if (rerender) render()
  saveState(state).catch((error: unknown) => {
    console.error('[Suno++] could not save settings', error)
  })
}

function link(text: string, href: string): HTMLAnchorElement {
  return el('a', { text, attrs: { href, target: '_blank', rel: 'noreferrer' } })
}

function byline(authors: readonly Author[]): HTMLElement {
  const span = el('span', { class: 'by' }, 'by ')
  authors.forEach((author, i) => {
    if (i > 0) span.append(', ')
    span.append(
      author.github ? link(author.name, `https://github.com/${author.github}`) : author.name
    )
  })
  return span
}

function toggle(
  id: string,
  checked: boolean,
  label: string,
  onChange: (checked: boolean) => void
): HTMLElement {
  const input = el('input', {
    attrs: { type: 'checkbox', role: 'switch', id, 'aria-label': label }
  })
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  // The visible switch is drawn on a sibling span; generated content on the checkbox itself
  // isn't consistently supported across browsers. The real checkbox keeps keyboard and
  // screen reader support.
  return el('span', { class: 'switch' }, input, el('span', { class: 'switch-track' }))
}

function setSetting(pluginId: string, key: string, value: SettingValue): void {
  commit(
    (s) => ({
      ...s,
      settings: { ...s.settings, [pluginId]: { ...s.settings[pluginId], [key]: value } }
    }),
    false
  )
}

function settingControl(
  manifest: PluginManifest,
  def: SettingDefinition,
  value: SettingValue,
  id: string
): HTMLElement {
  const save = (next: SettingValue) => setSetting(manifest.id, def.key, next)
  switch (def.type) {
    case 'boolean':
      return toggle(id, value === true, def.label, save)
    case 'string': {
      const input = el('input', {
        attrs: {
          type: 'text',
          id,
          maxlength: String(def.maxLength),
          ...(def.placeholder ? { placeholder: def.placeholder } : {})
        }
      })
      input.value = String(value)
      input.addEventListener('change', () => save(input.value.slice(0, def.maxLength)))
      return input
    }
    case 'number': {
      const input = el('input', {
        attrs: {
          type: 'number',
          id,
          ...(def.min !== undefined ? { min: String(def.min) } : {}),
          ...(def.max !== undefined ? { max: String(def.max) } : {}),
          ...(def.step !== undefined ? { step: String(def.step) } : {})
        }
      })
      input.value = String(value)
      input.addEventListener('change', () => {
        const next = Number(input.value)
        const valid =
          input.value !== '' &&
          Number.isFinite(next) &&
          next >= (def.min ?? -Infinity) &&
          next <= (def.max ?? Infinity)
        if (valid) save(next)
        else input.value = String(value)
      })
      return input
    }
    case 'select': {
      const select = el(
        'select',
        { attrs: { id } },
        ...def.options.map((o) => el('option', { text: o.label, attrs: { value: o.value } }))
      )
      select.value = String(value)
      select.addEventListener('change', () => save(select.value))
      return select
    }
  }
}

function settingsPanel(manifest: PluginManifest): HTMLElement {
  const values = resolveSettings(manifest.settings, state.settings[manifest.id])
  return el(
    'div',
    { class: 'settings' },
    ...manifest.settings.map((def) => {
      const id = `setting-${manifest.id}-${def.key}`
      const value = values[def.key] ?? def.default
      return el(
        'div',
        { class: 'setting' },
        el(
          'label',
          { attrs: { for: id } },
          def.label,
          def.description ? el('small', { text: def.description }) : null
        ),
        settingControl(manifest, def, value, id)
      )
    })
  )
}

function pluginCard(manifest: PluginManifest): HTMLElement {
  const on = isPluginEnabled(manifest, state)
  return el(
    'article',
    { class: on ? 'card on' : 'card' },
    el(
      'div',
      { class: 'card-head' },
      el(
        'div',
        { class: 'card-title' },
        el('h3', { text: manifest.name }),
        el('p', { class: 'meta' }, `v${manifest.version} · `, byline(manifest.authors))
      ),
      toggle(`plugin-${manifest.id}`, on, `Turn ${manifest.name} on`, (checked) =>
        commit((s) => ({ ...s, enabled: { ...s.enabled, [manifest.id]: checked } }), true)
      )
    ),
    el('p', { class: 'desc', text: manifest.description }),
    on && manifest.settings.length > 0 ? settingsPanel(manifest) : null
  )
}

function colorsPanel(manifest: ThemeManifest): HTMLElement {
  const values = resolveThemeVariables(manifest.variables, state.themeVariables[manifest.id])
  const setColor = (key: string, color: string) =>
    commit(
      (s) => ({
        ...s,
        themeVariables: {
          ...s.themeVariables,
          [manifest.id]: { ...s.themeVariables[manifest.id], [key]: color }
        }
      }),
      false
    )
  return el(
    'div',
    { class: 'settings colors' },
    ...manifest.variables.map((variable) => {
      const id = `color-${manifest.id}-${variable.key}`
      const input = el('input', { attrs: { type: 'color', id } })
      input.value = values[variable.key] ?? variable.default
      // Live preview while picking, without re-rendering (that would close the picker).
      input.addEventListener('input', () => setColor(variable.key, input.value))
      return el(
        'div',
        { class: 'setting' },
        el('label', { attrs: { for: id }, text: variable.label }),
        input
      )
    }),
    el('button', {
      class: 'button',
      text: 'Reset colors',
      attrs: { type: 'button', id: `reset-${manifest.id}` },
      on: {
        click: () => {
          commit((s) => {
            const { [manifest.id]: _removed, ...rest } = s.themeVariables
            return { ...s, themeVariables: rest }
          }, true)
        }
      }
    })
  )
}

function themeOption(manifest: ThemeManifest | null): HTMLElement {
  const id = manifest?.id ?? null
  const active = state.theme === id
  const inputId = `theme-${id ?? 'none'}`
  const radio = el('input', { attrs: { type: 'radio', name: 'theme', id: inputId } })
  radio.checked = active
  radio.addEventListener('change', () => {
    if (radio.checked) commit((s) => ({ ...s, theme: id }), true)
  })
  const label = el(
    'label',
    { class: active ? 'card theme on' : 'card theme', attrs: { for: inputId } },
    radio,
    el(
      'div',
      { class: 'card-title' },
      el(
        'h3',
        {},
        manifest?.name ?? "Suno's own look",
        manifest ? el('span', { class: 'badge', text: APPEARANCE[manifest.appearance] }) : null
      ),
      manifest
        ? el('p', { class: 'meta' }, `v${manifest.version} · `, byline(manifest.authors))
        : null,
      el('p', {
        class: 'desc',
        text: manifest?.description ?? 'No theme. Suno looks the way Suno made it.'
      })
    )
  )
  return el(
    'div',
    {},
    label,
    active && manifest && manifest.variables.length > 0 ? colorsPanel(manifest) : null
  )
}

function section(
  id: string,
  title: string,
  hint: string,
  ...content: (HTMLElement | null)[]
): HTMLElement {
  return el(
    'section',
    { attrs: { 'aria-labelledby': id } },
    el('h2', { text: title, attrs: { id } }),
    popup ? null : el('p', { class: 'hint', text: hint }),
    ...content
  )
}

function render(): void {
  const focused = document.activeElement?.id
  const version = extensionApi().runtime.getManifest().version
  app.replaceChildren(
    el(
      'header',
      { class: 'top' },
      el('img', { attrs: { src: 'icons/icon-48.png', alt: '', width: '40', height: '40' } }),
      el(
        'div',
        { class: 'brand' },
        el('h1', { text: 'Suno++' }),
        el('p', { class: 'tagline', text: 'Community plugins and themes for Suno' })
      ),
      popup
        ? el('button', {
            class: 'button',
            text: 'All settings',
            attrs: { type: 'button' },
            on: { click: () => void extensionApi().runtime.openOptionsPage() }
          })
        : el('span', { class: 'version', text: `v${version}` })
    ),
    section(
      'plugins-title',
      'Plugins',
      'Turn on what you want. Changes reach open Suno tabs right away.',
      ...(catalog.plugins.length > 0
        ? catalog.plugins.map((p) => pluginCard(p.manifest))
        : [el('p', { class: 'empty', text: 'No plugins yet. Be the first to make one!' })])
    ),
    section(
      'themes-title',
      'Themes',
      'One theme at a time. Themes only change how suno.com looks.',
      el(
        'div',
        { attrs: { role: 'radiogroup', 'aria-labelledby': 'themes-title' } },
        themeOption(null),
        ...catalog.themes.map((t) => themeOption(t.manifest))
      )
    ),
    el(
      'footer',
      {},
      el(
        'p',
        {},
        'Suno++ is made by the community. ',
        link('Make your own plugin or theme', `${REPO}/blob/main/CONTRIBUTING.md`),
        ' · ',
        link('Report a problem', `${REPO}/issues`)
      ),
      el('p', {
        class: 'fine',
        text: 'Unofficial. Not affiliated with, sponsored by or endorsed by Suno, Inc.'
      })
    )
  )
  app.removeAttribute('aria-busy')
  if (focused) document.getElementById(focused)?.focus()
}

onStateChanged((next) => {
  const json = JSON.stringify(next)
  if (json === savedJson) return
  state = next
  savedJson = json
  render()
})

loadState().then(
  (loaded) => {
    state = loaded
    savedJson = JSON.stringify(loaded)
    render()
  },
  (error: unknown) => {
    app.replaceChildren(el('p', { class: 'empty', text: 'Could not load your settings.' }))
    console.error('[Suno++]', error)
  }
)
