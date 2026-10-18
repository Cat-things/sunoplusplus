import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  definePlugin,
  el,
  observe,
  onElement,
  setInputValue,
  waitForElement
} from '@sunoplusplus/sdk'

afterEach(() => {
  document.body.replaceChildren()
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('definePlugin', () => {
  it('returns a frozen plugin module', () => {
    const setup = () => undefined
    const plugin = definePlugin(setup)
    expect(plugin).toEqual({ kind: 'sunoplusplus.plugin', setup })
    expect(Object.isFrozen(plugin)).toBe(true)
  })
})

describe('DOM helpers', () => {
  it('waitForElement resolves now or when the element appears', async () => {
    document.body.append(el('div', { class: 'now' }))
    await expect(waitForElement('.now')).resolves.toBeInstanceOf(HTMLDivElement)
    const later = waitForElement('.later')
    setTimeout(() => document.body.append(el('span', { class: 'later' })), 5)
    await expect(later).resolves.toBeInstanceOf(HTMLSpanElement)
  })

  it('waitForElement times out and aborts', async () => {
    await expect(waitForElement('.never', { timeout: 10 })).rejects.toMatchObject({
      name: 'TimeoutError'
    })
    const controller = new AbortController()
    const waiting = waitForElement('.never', { signal: controller.signal })
    controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('onElement sees existing and future elements once each, until aborted', async () => {
    const controller = new AbortController()
    const seen: string[] = []
    document.body.append(el('p', { class: 'x', text: 'a' }))
    onElement('.x', (e) => seen.push(e.textContent), { signal: controller.signal })
    document.body.append(el('p', { class: 'x', text: 'b' }))
    await tick()
    document.body.append(el('i', { text: 'unrelated' }))
    await tick()
    controller.abort()
    document.body.append(el('p', { class: 'x', text: 'c' }))
    await tick()
    expect(seen).toEqual(['a', 'b'])
  })

  it('observe stops when told to', async () => {
    const callback = vi.fn()
    const stop = observe(document.body, callback)
    document.body.append(el('div'))
    await tick()
    stop()
    document.body.append(el('div'))
    await tick()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('setInputValue goes through the native setter and fires input and change', () => {
    const textarea = el('textarea')
    const events: string[] = []
    textarea.addEventListener('input', () => events.push('input'))
    textarea.addEventListener('change', () => events.push('change'))
    // Frameworks like React shadow `value` on the element; the prototype setter must still run.
    let shadowed = ''
    Object.defineProperty(textarea, 'value', {
      configurable: true,
      get: () => shadowed,
      set: (v: string) => {
        shadowed = `shadow:${v}`
      }
    })
    setInputValue(textarea, 'dreamy synthwave')
    expect(events).toEqual(['input', 'change'])
    expect(shadowed).toBe('')
    expect(
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.get?.call(textarea)
    ).toBe('dreamy synthwave')
  })

  it('el builds elements safely', () => {
    const click = vi.fn()
    const button = el(
      'button',
      { class: 'b', text: '<img src=x>', attrs: { 'aria-label': 'Go' }, on: { click } },
      el('span'),
      null,
      false,
      'tail'
    )
    expect(button.className).toBe('b')
    expect(button.querySelector('img')).toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Go')
    expect(button.childNodes).toHaveLength(3)
    button.click()
    expect(click).toHaveBeenCalledOnce()
    expect(() => el('div', { attrs: { onclick: 'alert(1)' } })).toThrow(/use "on"/)
  })
})
