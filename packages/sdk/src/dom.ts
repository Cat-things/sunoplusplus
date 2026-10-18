/**
 * Small DOM helpers for plugins. Suno is a single-page app that re-renders often, so prefer
 * `onElement` (which also sees elements added later) over grabbing an element once.
 * Every helper takes an optional AbortSignal; pass `ctx.signal` and it cleans up by itself when
 * the plugin is turned off.
 */

export type Unsubscribe = () => void

interface SignalOption {
  readonly signal?: AbortSignal
}

function onAbort(signal: AbortSignal | undefined, stop: () => void): void {
  if (!signal) return
  if (signal.aborted) stop()
  else signal.addEventListener('abort', stop, { once: true })
}

/** Watches `target` for DOM changes. Returns a function that stops watching. */
export function observe(
  target: Node,
  callback: (mutations: MutationRecord[]) => void,
  options: MutationObserverInit & SignalOption = { childList: true, subtree: true }
): Unsubscribe {
  const { signal, ...init } = options
  const observer = new MutationObserver(callback)
  observer.observe(target, init)
  const stop = (): void => {
    observer.disconnect()
  }
  onAbort(signal, stop)
  return stop
}

/**
 * Calls `callback` once for every element matching `selector`: the ones already there and any
 * that appear later (for example after Suno re-renders a page). Returns a function that stops.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- lets callers name the element type, like querySelector<E>
export function onElement<E extends Element = HTMLElement>(
  selector: string,
  callback: (element: E) => void,
  options: SignalOption & { readonly root?: ParentNode & Node } = {}
): Unsubscribe {
  const root = options.root ?? document
  const seen = new WeakSet<Element>()
  const scan = (): void => {
    for (const element of root.querySelectorAll<E>(selector)) {
      if (seen.has(element)) continue
      seen.add(element)
      callback(element)
    }
  }
  scan()
  return observe(root, scan, { childList: true, subtree: true, signal: options.signal })
}

/**
 * Resolves with the first element matching `selector`, waiting for it to appear if needed.
 * Rejects with a `TimeoutError` after `timeout` ms (default 10 s) or an `AbortError` on abort.
 */
export function waitForElement<E extends Element = HTMLElement>(
  selector: string,
  options: SignalOption & { readonly root?: ParentNode & Node; readonly timeout?: number } = {}
): Promise<E> {
  const root = options.root ?? document
  return new Promise<E>((resolve, reject) => {
    const found = root.querySelector<E>(selector)
    if (found) {
      resolve(found)
      return
    }
    const controller = new AbortController()
    const finish = (): void => {
      controller.abort()
      clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      finish()
      reject(new DOMException(`"${selector}" did not appear in time`, 'TimeoutError'))
    }, options.timeout ?? 10_000)
    onAbort(options.signal, () => {
      finish()
      reject(new DOMException('Aborted', 'AbortError'))
    })
    observe(
      root,
      () => {
        const element = root.querySelector<E>(selector)
        if (!element) return
        finish()
        resolve(element)
      },
      { childList: true, subtree: true, signal: controller.signal }
    )
  })
}

/**
 * Sets an input's or textarea's value the way typing would, so frameworks like React (which
 * Suno uses) notice the change and their own validation runs.
 */
export function setInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  // Runs the prototype's setter with the element as `this`, bypassing a framework's own
  // `value` property on the element.
  if (!Reflect.set(prototype, 'value', value, element)) element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

type Child = Node | string | null | undefined | false

export interface ElementOptions {
  readonly class?: string
  readonly text?: string
  readonly attrs?: Readonly<Record<string, string>>
  readonly on?: {
    readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void
  }
}

/**
 * Builds an element without innerHTML, so text from songs or users can never turn into markup.
 *
 *   el('button', { class: 'spp-btn', text: 'Suggest', on: { click: suggest } })
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (options.class) element.className = options.class
  if (options.text !== undefined) element.textContent = options.text
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (/^on/i.test(name))
      throw new Error(`use "on" for event handlers, not the "${name}" attribute`)
    element.setAttribute(name, value)
  }
  for (const [type, listener] of Object.entries(options.on ?? {})) {
    element.addEventListener(type, listener as EventListener)
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    element.append(child)
  }
  return element
}
