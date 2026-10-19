/**
 * The Suno++ marketplace: a static page that lists everything in registry.json (built from
 * plugins/ and themes/), with search and filters. "Add to Suno Desktop" uses the app's
 * suno-desktop:// links, which ask before turning anything on.
 */
import { el } from '@sunoplusplus/sdk'

const REPO = 'https://github.com/Cat-things/sunoplusplus'

interface Entry {
  readonly kind: 'plugin' | 'theme'
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly authors: readonly { readonly name: string; readonly github?: string }[]
  readonly tags: readonly string[]
  readonly path: string
  readonly appearance?: 'dark' | 'light' | 'any'
}

interface Registry {
  readonly sunoplusplusVersion: string
  readonly plugins: readonly Omit<Entry, 'kind'>[]
  readonly themes: readonly Omit<Entry, 'kind'>[]
}

type Kind = 'all' | 'plugin' | 'theme'

const app = document.getElementById('app') ?? document.body
let entries: Entry[] = []
let query = ''
let kind: Kind = 'all'
let tag: string | null = null

function matches(entry: Entry): boolean {
  if (kind !== 'all' && entry.kind !== kind) return false
  if (tag && !entry.tags.includes(tag)) return false
  const haystack = [
    entry.name,
    entry.description,
    ...entry.tags,
    ...entry.authors.map((a) => a.name)
  ]
    .join(' ')
    .toLowerCase()
  return query.split(/\s+/).every((word) => haystack.includes(word))
}

function byline(entry: Entry): HTMLElement {
  const p = el('p', { class: 'meta' }, `v${entry.version} · by `)
  entry.authors.forEach((author, i) => {
    if (i > 0) p.append(', ')
    p.append(
      author.github
        ? el('a', { text: author.name, attrs: { href: `https://github.com/${author.github}` } })
        : author.name
    )
  })
  return p
}

function card(entry: Entry): HTMLElement {
  const appearance =
    entry.appearance === 'dark' ? ' · Dark' : entry.appearance === 'light' ? ' · Light' : ''
  return el(
    'article',
    { class: 'card' },
    el('span', {
      class: `kind ${entry.kind}`,
      text: `${entry.kind === 'plugin' ? 'Plugin' : 'Theme'}${appearance}`
    }),
    el('h2', { text: entry.name }),
    el('p', { class: 'desc', text: entry.description }),
    byline(entry),
    entry.tags.length > 0
      ? el('p', { class: 'meta', text: entry.tags.map((t) => `#${t}`).join(' ') })
      : null,
    el(
      'div',
      { class: 'actions' },
      el('a', {
        class: 'button primary',
        text: 'Add to Suno Desktop',
        attrs: { href: `suno-desktop://${entry.kind}/install?id=${encodeURIComponent(entry.id)}` }
      }),
      el('a', {
        class: 'button',
        text: 'Source',
        attrs: { href: `${REPO}/tree/main/${entry.path}` }
      })
    )
  )
}

function render(): void {
  const focused = document.activeElement?.id
  const shown = entries.filter(matches)
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const search = el('input', {
    class: 'search',
    attrs: {
      id: 'search',
      type: 'search',
      placeholder: 'Search plugins and themes',
      'aria-label': 'Search'
    }
  })
  search.value = query
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase()
    render()
  })
  const kinds: [Kind, string][] = [
    ['all', 'All'],
    ['plugin', 'Plugins'],
    ['theme', 'Themes']
  ]
  app.replaceChildren(
    el(
      'div',
      { class: 'controls' },
      search,
      el(
        'div',
        { class: 'segmented', attrs: { role: 'group', 'aria-label': 'Show' } },
        ...kinds.map(([value, label]) =>
          el('button', {
            text: label,
            attrs: { type: 'button', id: `kind-${value}`, 'aria-pressed': String(kind === value) },
            on: {
              click: () => {
                kind = value
                render()
              }
            }
          })
        )
      )
    ),
    el(
      'div',
      { class: 'tags', attrs: { role: 'group', 'aria-label': 'Tags' } },
      ...tags.map((t) =>
        el('button', {
          class: 'chip',
          text: `#${t}`,
          attrs: { type: 'button', id: `tag-${t}`, 'aria-pressed': String(tag === t) },
          on: {
            click: () => {
              tag = tag === t ? null : t
              render()
            }
          }
        })
      )
    ),
    el('p', {
      class: 'count',
      attrs: { role: 'status' },
      text: `${String(shown.length)} of ${String(entries.length)} shown`
    }),
    shown.length > 0
      ? el('div', { class: 'grid' }, ...shown.map(card))
      : el('p', { class: 'empty', text: 'Nothing matches. Got an idea? Make it!' })
  )
  app.removeAttribute('aria-busy')
  if (focused) document.getElementById(focused)?.focus()
}

fetch('registry.json')
  .then((response) => response.json() as Promise<Registry>)
  .then((registry) => {
    entries = [
      ...registry.plugins.map((p): Entry => ({ ...p, kind: 'plugin' })),
      ...registry.themes.map((t): Entry => ({ ...t, kind: 'theme' }))
    ].sort((a, b) => a.name.localeCompare(b.name))
    render()
  })
  .catch((error: unknown) => {
    app.replaceChildren(
      el('p', { class: 'empty', text: "Couldn't load the marketplace. Try again later." })
    )
    console.error(error)
  })
