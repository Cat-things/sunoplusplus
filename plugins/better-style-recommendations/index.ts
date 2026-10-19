import { definePlugin, el, onElement, setInputValue } from '@sunoplusplus/sdk'
import { applySuggestion, seeded, suggestStyles, type Suggestion } from './engine.ts'
import styles from './styles.css'

interface Settings {
  count: number
  mode: string
  wandSelector: string
}

/** Words Suno's wand button tends to carry in its label, title, test id or icon. */
const WAND_HINT = /wand|magic|sparkle|enhance|inspire|suggest|random|improve|generate/i
const STYLES_HINT = /style/i
const NOT_STYLES = /exclude|negative/i
const STYLES_LIMIT = 1000

function isStylesBox(node: Element): node is HTMLTextAreaElement | HTMLInputElement {
  if (!(node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement)) return false
  const label = ['placeholder', 'aria-label', 'name', 'id', 'data-testid']
    .map((a) => node.getAttribute(a) ?? '')
    .join(' ')
  return STYLES_HINT.test(label) && !NOT_STYLES.test(label)
}

/**
 * The Styles box that `start` belongs to: the first text field found going up from it. If that
 * field is another box (like Exclude styles), `start` doesn't belong to the Styles box.
 */
function stylesBoxNear(start: Element): HTMLTextAreaElement | HTMLInputElement | null {
  let node: Element | null = start
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    const fields = [...node.querySelectorAll('textarea, input[type="text"]')]
    if (fields.length > 0) return fields.find(isStylesBox) ?? null
  }
  return null
}

function describe(button: Element): string {
  const icon = button.querySelector('svg')
  return [
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.getAttribute('data-testid'),
    button.textContent,
    icon?.getAttribute('class'),
    icon?.getAttribute('data-icon'),
    icon?.getAttribute('aria-label')
  ]
    .filter(Boolean)
    .join(' ')
}

export default definePlugin<Settings>((ctx) => {
  ctx.addStyle(styles)
  let popover: HTMLElement | null = null

  const isWand = (button: Element): boolean => {
    const custom = ctx.settings.get('wandSelector').trim()
    if (custom) {
      try {
        return button.matches(custom)
      } catch {
        ctx.log.warn(`"${custom}" isn't a valid CSS selector`)
        return false
      }
    }
    return WAND_HINT.test(describe(button)) && stylesBoxNear(button) !== null
  }

  const close = (): void => {
    popover?.remove()
    popover = null
  }

  const open = (anchor: Element): void => {
    close()
    const box = stylesBoxNear(anchor)
    if (!box) return
    let seed = Date.now()
    const list = el('ul', { class: 'spp-bsr-list' })
    const render = (): void => {
      const suggestions = suggestStyles({
        current: box.value,
        count: ctx.settings.get('count'),
        rng: seeded(seed)
      })
      list.replaceChildren(
        ...suggestions.map((suggestion: Suggestion) =>
          el(
            'li',
            {},
            el('span', { class: 'spp-bsr-tags', text: suggestion.text }),
            el('button', {
              class: 'spp-bsr-use',
              text: 'Use',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  const mode = ctx.settings.get('mode') === 'replace' ? 'replace' : 'add'
                  setInputValue(box, applySuggestion(box.value, suggestion, mode, STYLES_LIMIT))
                  close()
                  box.focus()
                }
              }
            })
          )
        )
      )
    }
    render()
    popover = el(
      'div',
      { class: 'spp-bsr-pop', attrs: { role: 'dialog', 'aria-label': 'Better style suggestions' } },
      el(
        'div',
        { class: 'spp-bsr-head' },
        el('span', { text: '✨ Better style suggestions' }),
        el('button', {
          class: 'spp-bsr-close',
          text: '×',
          attrs: { type: 'button', 'aria-label': 'Close' },
          on: { click: close }
        })
      ),
      list,
      el(
        'div',
        { class: 'spp-bsr-foot' },
        el('button', {
          class: 'spp-bsr-more',
          text: 'More ideas',
          attrs: { type: 'button' },
          on: {
            click: () => {
              seed += 1
              render()
            }
          }
        }),
        el('span', { text: "Shift+click the wand for Suno's own" })
      )
    )
    const rect = anchor.getBoundingClientRect()
    popover.style.top = `${String(Math.round(rect.bottom + 8))}px`
    popover.style.left = `${String(Math.round(Math.max(8, Math.min(rect.right - 380, innerWidth - 388))))}px`
    document.body.append(popover)
    popover.querySelector<HTMLButtonElement>('.spp-bsr-use')?.focus()
  }

  // Capture phase on document: runs before Suno's own handlers, so the wand opens our
  // suggestions instead. Shift+click lets Suno's wand do its thing.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (popover && target && !popover.contains(target)) close()
      const button = target?.closest('button')
      if (!button || event.shiftKey || popover?.contains(button) || !isWand(button)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      open(button)
    },
    { capture: true, signal: ctx.signal }
  )
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') close()
    },
    { signal: ctx.signal }
  )

  // If Suno ever drops the wand, still offer suggestions with a small button of our own.
  onElement(
    'textarea, input[type="text"]',
    (node) => {
      if (!isStylesBox(node)) return
      setTimeout(() => {
        if (ctx.signal.aborted || !node.isConnected) return
        const container = node.parentElement
        if (!container || [...container.querySelectorAll('button')].some((b) => isWand(b))) return
        if (container.querySelector('.spp-bsr-fallback')) return
        const button = el('button', {
          class: 'spp-bsr-fallback',
          text: '✨',
          attrs: {
            type: 'button',
            'aria-label': 'Better style suggestions (Suno++)',
            title: 'Better style suggestions'
          },
          on: { click: () => open(button) }
        })
        container.append(button)
        ctx.onCleanup(() => button.remove())
      }, 1500)
    },
    { signal: ctx.signal }
  )

  return close
})
