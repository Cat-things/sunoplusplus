/**
 * Runs in suno.com's own JavaScript world (content script with `world: "MAIN"`) at
 * document_start. Suno plays audio through elements that never join the DOM, which the
 * isolated world cannot see, so this watches play/pause on media elements and reports only
 * "playing", "paused" or "none" to the isolated world. It exposes nothing to the page.
 */
import { MEDIA_PROBE_EVENT } from '@sunoplusplus/runtime'

const MAX_TRACKED = 32
const tracked = new Set<HTMLMediaElement>()
let last = ''

function current(): string {
  const all = [...tracked, ...document.querySelectorAll<HTMLMediaElement>('audio, video')]
  if (all.some((m) => !m.paused && !m.ended)) return 'playing'
  return all.some((m) => m.currentSrc) ? 'paused' : 'none'
}

function report(): void {
  const state = current()
  if (state === last) return
  last = state
  document.dispatchEvent(new CustomEvent(MEDIA_PROBE_EVENT, { detail: state }))
}

function track(media: HTMLMediaElement): void {
  if (tracked.has(media)) return
  if (tracked.size >= MAX_TRACKED) {
    // Forget idle elements first; Suno may create a new one per song.
    for (const old of tracked) {
      if (old.paused && !old.isConnected) tracked.delete(old)
      if (tracked.size < MAX_TRACKED) break
    }
  }
  tracked.add(media)
  for (const type of ['play', 'playing', 'pause', 'ended', 'emptied'])
    media.addEventListener(type, report)
}

// eslint-disable-next-line @typescript-eslint/unbound-method -- called below with the element as `this`
const play = HTMLMediaElement.prototype.play
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: function (this: HTMLMediaElement) {
    track(this)
    return play.call(this)
  }
})

// Media elements in the DOM, including ones started by the page's own controls.
document.addEventListener(
  'play',
  (event) => {
    if (event.target instanceof HTMLMediaElement) track(event.target)
    report()
  },
  true
)
