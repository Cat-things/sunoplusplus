import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginManifest } from '@sunoplusplus/core'
import {
  EMPTY_STATE,
  Emitter,
  Runtime,
  memoryStorage,
  routeOf,
  type Host
} from '@sunoplusplus/runtime'
import manifest from '../plugins/better-style-recommendations/manifest.json'
import plugin from '../plugins/better-style-recommendations/index.ts'
import {
  applySuggestion,
  detectGenres,
  parseTags,
  seeded,
  suggestStyles
} from '../plugins/better-style-recommendations/engine.ts'

describe('style engine', () => {
  it('stays in the genre you typed and never repeats your tags', () => {
    const current = 'synthwave, female vocals, analog synths'
    const ideas = suggestStyles({ current, count: 5, rng: seeded(7) })
    expect(ideas).toHaveLength(5)
    expect(new Set(ideas.map((i) => i.text)).size).toBe(5)
    for (const idea of ideas) {
      expect(idea.tags.map((t) => t.toLowerCase())).not.toContain('analog synths')
      expect(idea.tags).not.toContain('synthwave')
    }
    expect(detectGenres(current).map((g) => g.name)).toEqual(['synthwave'])
  })

  it('explores different genres when the box is empty, and adds a tempo once', () => {
    const ideas = suggestStyles({ current: '', count: 6, rng: seeded(3) })
    expect(new Set(ideas.map((i) => i.tags[0])).size).toBe(6)
    expect(ideas.every((i) => i.tags.some((t) => /\d+ bpm$/.test(t)))).toBe(true)
    const withTempo = suggestStyles({ current: 'house, 124 bpm', count: 3, rng: seeded(3) })
    expect(withTempo.every((i) => !i.tags.some((t) => t.endsWith('bpm')))).toBe(true)
  })

  it('is reproducible with the same seed', () => {
    const a = suggestStyles({ current: 'jazz', count: 4, rng: seeded(42) })
    const b = suggestStyles({ current: 'jazz', count: 4, rng: seeded(42) })
    expect(a).toEqual(b)
  })

  it('adds or replaces, staying within the limit', () => {
    const idea = { tags: ['deep house', 'groovy', 'piano stabs'], text: '' }
    expect(applySuggestion('house, warm', idea, 'add')).toBe(
      'house, warm, deep house, groovy, piano stabs'
    )
    expect(applySuggestion('house, warm', idea, 'replace')).toBe(
      'house, deep house, groovy, piano stabs'
    )
    expect(applySuggestion('x'.repeat(20), idea, 'add', 34)).toBe(`${'x'.repeat(20)}, deep house`)
    expect(parseTags(' a, ,b\nc ')).toEqual(['a', 'b', 'c'])
  })
})

function host(): Host {
  return {
    env: { kind: 'extension', apiVersion: 1 },
    currentRoute: () => routeOf('https://suno.com/create'),
    onRoute: (l) => new Emitter<never>().on(l),
    currentSong: () => null,
    onSong: (l) => new Emitter<never>().on(l),
    currentPlayback: () => 'none',
    onPlayback: (l) => new Emitter<never>().on(l),
    storage: () => memoryStorage()
  }
}

function must<T>(value: T | null): T {
  if (value === null) throw new Error('missing element')
  return value
}

function sunoCreatePage() {
  document.body.innerHTML = `
    <div class="styles">
      <textarea placeholder="Style of Music">dream pop</textarea>
      <button aria-label="Enhance styles"><svg></svg></button>
    </div>
    <div class="exclude">
      <input type="text" placeholder="Exclude styles" />
      <button aria-label="Random exclude"></button>
    </div>`
  const sunoWand = vi.fn()
  document.querySelector('[aria-label="Enhance styles"]')?.addEventListener('click', sunoWand)
  return {
    sunoWand,
    styles: must(document.querySelector('textarea')),
    wand: must(document.querySelector<HTMLButtonElement>('[aria-label="Enhance styles"]'))
  }
}

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.replaceChildren()
})

describe('Better Style recommendations plugin', () => {
  function start() {
    runtime = new Runtime({
      host: host(),
      catalog: {
        plugins: [{ manifest: manifest as unknown as PluginManifest, module: plugin }],
        themes: []
      }
    })
    runtime.start({ ...EMPTY_STATE, enabled: { 'better-style-recommendations': true } })
  }

  it('opens better suggestions from the wand and fills the Styles box', () => {
    const page = sunoCreatePage()
    start()
    page.wand.click()
    expect(page.sunoWand).not.toHaveBeenCalled()
    const items = document.querySelectorAll('.spp-bsr-list li')
    expect(items).toHaveLength(5)
    const input = vi.fn()
    page.styles.addEventListener('input', input)
    const first = items[0]?.querySelector('.spp-bsr-tags')?.textContent ?? ''
    items[0]?.querySelector<HTMLButtonElement>('.spp-bsr-use')?.click()
    expect(page.styles.value).toBe(`dream pop, ${first}`)
    expect(input).toHaveBeenCalledOnce()
    expect(document.querySelector('.spp-bsr-pop')).toBeNull()
  })

  it("leaves Suno's wand alone on Shift+click and ignores other buttons", () => {
    const page = sunoCreatePage()
    start()
    page.wand.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(page.sunoWand).toHaveBeenCalledOnce()
    document.querySelector<HTMLButtonElement>('[aria-label="Random exclude"]')?.click()
    expect(document.querySelector('.spp-bsr-pop')).toBeNull()
  })

  it('closes with Escape and cleans up when turned off', () => {
    const page = sunoCreatePage()
    start()
    page.wand.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.spp-bsr-pop')).toBeNull()
    page.wand.click()
    runtime?.setState(EMPTY_STATE)
    expect(document.querySelector('.spp-bsr-pop')).toBeNull()
    page.wand.click()
    expect(page.sunoWand).toHaveBeenCalledOnce()
  })
})
