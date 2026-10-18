/**
 * Loads the built extension (dist/extension/chrome) into real Chromium, serves a fake suno.com
 * and drives the options page like a user. Nothing talks to Suno. Run `pnpm build` first; on
 * Linux run under a display (xvfb-run -a pnpm test:e2e).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type BrowserContext, type Page } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '../..')
const extensionDir = path.join(root, 'dist/extension/chrome')
const artifacts = path.join(root, 'test-results/e2e')

const FAKE_SUNO = `<!doctype html>
<html>
  <head><title>Suno | AI Music</title></head>
  <body>
    <h1>Fake Suno</h1>
    <a id="create" href="/create">Create</a>
    <script>
      document.getElementById('create').addEventListener('click', (event) => {
        event.preventDefault()
        history.pushState(null, '', '/create')
        document.title = 'Create | Suno'
      })
      window.setSong = (state) => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Neon Rain',
          artist: 'Cat',
          artwork: [{ src: 'https://cdn1.suno.ai/image_a.jpeg' }]
        })
        navigator.mediaSession.playbackState = state
      }
    </script>
  </body>
</html>`

/** Chromium derives an unpacked extension's id from its absolute path. */
function extensionId(dir: string): string {
  const hash = createHash('sha256').update(dir).digest('hex').slice(0, 32)
  return hash.replace(/./g, (c) => String.fromCharCode(97 + parseInt(c, 16)))
}

/** One second of silence as a WAV data URL, for the media probe test. */
function silentWav(): string {
  const rate = 8000
  const data = Buffer.alloc(rate)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate, 28)
  header.writeUInt16LE(1, 32)
  header.writeUInt16LE(8, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  data.fill(128)
  return `data:audio/wav;base64,${Buffer.concat([header, data]).toString('base64')}`
}

let context: BrowserContext
let userDataDir = ''
let suno: Page
let options: Page
const sunoErrors: string[] = []

async function screenshot(page: Page, name: string): Promise<void> {
  // Background tabs don't repaint, so capture the page in front.
  await page.bringToFront()
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) })
}

async function titleBecomes(expected: string): Promise<void> {
  await suno.waitForFunction((t) => document.title === t, expected, { timeout: 10_000 })
}

beforeAll(async () => {
  if (!existsSync(path.join(extensionDir, 'manifest.json'))) {
    throw new Error('Run pnpm build before the e2e tests')
  }
  mkdirSync(artifacts, { recursive: true })
  userDataDir = mkdtempSync(path.join(tmpdir(), 'spp-e2e-'))
  const bundled = '/opt/pw-browsers/chromium'
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: process.env.SPP_CHROMIUM ?? (existsSync(bundled) ? bundled : undefined),
    viewport: { width: 900, height: 900 },
    reducedMotion: 'reduce',
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])
    ]
  })
  await context.route('https://suno.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: FAKE_SUNO })
  )
  suno = await context.newPage()
  suno.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Suno++'))
      sunoErrors.push(message.text())
  })
  await suno.goto('https://suno.com/')
  options = await context.newPage()
  await options.goto(`chrome-extension://${extensionId(extensionDir)}/options.html`)
  await options.waitForSelector('#plugin-now-playing-title')
}, 120_000)

afterAll(async () => {
  await context.close()
  rmSync(userDataDir, { recursive: true, force: true })
})

describe('Suno++ browser extension', () => {
  it('lists the bundled plugins and themes, all off by default', async () => {
    expect(await options.locator('article h3').allTextContents()).toEqual([
      'Now playing in the tab title'
    ])
    // Theme names are followed by their light/dark badge.
    expect(await options.locator('.theme h3').allTextContents()).toEqual([
      "Suno's own look",
      'Neon accentsLight & dark'
    ])
    expect(await options.isChecked('#plugin-now-playing-title')).toBe(false)
    expect(await options.isChecked('#theme-none')).toBe(true)
    await suno.evaluate(() => {
      ;(window as unknown as { setSong: (s: string) => void }).setSong('playing')
    })
    await new Promise((r) => setTimeout(r, 1200))
    expect(await suno.title()).toBe('Suno | AI Music')
    await screenshot(options, 'options')
  })

  it('turns a plugin on live and shows its settings', async () => {
    await options.click('#plugin-now-playing-title')
    await titleBecomes('♪ Neon Rain — Cat')
    await options.waitForSelector('#setting-now-playing-title-showArtist')
    await options.click('#setting-now-playing-title-showArtist')
    await titleBecomes('♪ Neon Rain')
    await options.selectOption('#setting-now-playing-title-symbol', 'play')
    await titleBecomes('▶ Neon Rain')
    await screenshot(options, 'options-plugin-on')
  })

  it("keeps up with Suno's own navigation and title changes", async () => {
    await suno.click('#create')
    await suno.waitForURL('https://suno.com/create')
    // Suno set its own title; the plugin puts the song back but remembers Suno's.
    await titleBecomes('▶ Neon Rain')
    await suno.evaluate(() => {
      navigator.mediaSession.playbackState = 'paused'
    })
    await titleBecomes('Create | Suno')
  })

  it('sees audio Suno plays outside the DOM, through the page-world probe', async () => {
    await suno.evaluate((src) => {
      navigator.mediaSession.playbackState = 'none'
      const audio = new Audio(src)
      audio.loop = true
      ;(window as unknown as { testAudio: HTMLAudioElement }).testAudio = audio
      return audio.play()
    }, silentWav())
    await titleBecomes('▶ Neon Rain')
    await suno.evaluate(() => {
      ;(window as unknown as { testAudio: HTMLAudioElement }).testAudio.pause()
    })
    await titleBecomes('Create | Suno')
  })

  it('applies a theme, recolors it live and removes it', async () => {
    await options.click('#theme-neon-accents')
    await suno.waitForSelector('#sunoplusplus-theme[data-theme="neon-accents"]', {
      state: 'attached'
    })
    const accent = () =>
      suno.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--spp-accent').trim()
      )
    expect(await accent()).toBe('#ff2e97')
    await options.waitForSelector('#color-neon-accents-accent')
    await options.locator('#color-neon-accents-accent').evaluate((input: HTMLInputElement) => {
      input.value = '#00ff88'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await suno.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue('--spp-accent').trim() ===
        '#00ff88'
    )
    await screenshot(options, 'options-theme')
    await options.click('#reset-neon-accents')
    await suno.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue('--spp-accent').trim() ===
        '#ff2e97'
    )
    await options.click('#theme-none')
    await suno.waitForSelector('#sunoplusplus-theme', { state: 'detached' })
  })

  it('turning the plugin off puts everything back', async () => {
    await suno.evaluate(() => {
      navigator.mediaSession.playbackState = 'playing'
    })
    await titleBecomes('▶ Neon Rain')
    await options.click('#plugin-now-playing-title')
    await titleBecomes('Create | Suno')
  })

  it('remembers choices across reloads', async () => {
    await options.click('#plugin-now-playing-title')
    await suno.reload()
    await suno.evaluate(() => {
      ;(window as unknown as { setSong: (s: string) => void }).setSong('playing')
    })
    await titleBecomes('▶ Neon Rain')
    await options.reload()
    expect(await options.isChecked('#plugin-now-playing-title')).toBe(true)
    expect(await options.inputValue('#setting-now-playing-title-symbol')).toBe('play')
  })

  it('exposes nothing to the page and logs no errors', async () => {
    const globals = await suno.evaluate(() =>
      Object.keys(window).filter((key) => /suno.?plus|spp/i.test(key))
    )
    expect(globals).toEqual([])
    expect(sunoErrors).toEqual([])
  })

  it('renders the popup and a dark options page', async () => {
    const popup = await context.newPage()
    await popup.setViewportSize({ width: 380, height: 600 })
    await popup.goto(`chrome-extension://${extensionId(extensionDir)}/popup.html`)
    await popup.waitForSelector('#plugin-now-playing-title')
    await screenshot(popup, 'popup')
    await popup.close()
    await options.emulateMedia({ colorScheme: 'dark' })
    await screenshot(options, 'options-dark')
  })
})

describe('Suno++ desktop bundle', () => {
  it('runs on Suno Desktop’s bridge and updates in place when re-run with new choices', async () => {
    const page = await context.newPage()
    await page.route('https://suno.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Suno</title><p>desktop</p>' })
    )
    await page.goto('https://suno.com/desktop-test')
    await page.evaluate(() => {
      const listeners = new Map<string, Set<(payload: unknown) => void>>()
      const bridge = {
        version: '0.1.1',
        apiVersion: 1,
        platform: 'win32',
        capabilities: [
          'desktop',
          'events.routeChanged',
          'events.songChanged',
          'events.playbackStateChanged'
        ],
        on(event: string, listener: (payload: unknown) => void) {
          const set = listeners.get(event) ?? new Set()
          set.add(listener)
          listeners.set(event, set)
          return () => set.delete(listener)
        }
      }
      const w = window as unknown as Record<string, unknown>
      w.sunoDesktop = Object.freeze(bridge)
      w.emitBridge = (event: string, payload: unknown) => {
        for (const listener of listeners.get(event) ?? []) listener(payload)
      }
    })
    const bundle = readFileSync(path.join(root, 'dist/desktop/sunoplusplus.js'), 'utf8')
    const run = (state: unknown) =>
      page.evaluate(
        ({ js, config }) => {
          ;(window as unknown as Record<string, unknown>).__SUNOPLUSPLUS_DESKTOP__ = config
          // Suno Desktop runs the bundle through its injection pipeline; eval stands in for it here.
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          ;(new Function(js) as () => void)()
        },
        { js: bundle, config: { state } }
      )
    await run({ enabled: { 'now-playing-title': true }, theme: 'neon-accents' })
    await page.evaluate(() => {
      const emit = (window as unknown as { emitBridge: (e: string, p: unknown) => void }).emitBridge
      emit('songChanged', { title: 'Desk Song', artist: 'App', album: '', artwork: [] })
      emit('playbackStateChanged', { state: 'playing' })
    })
    await page.waitForFunction(() => document.title === '♪ Desk Song — App')
    expect(await page.locator('#sunoplusplus-theme').count()).toBe(1)

    await run({ enabled: { 'now-playing-title': false }, theme: null })
    await page.waitForFunction(() => document.title === 'Suno')
    expect(await page.locator('#sunoplusplus-theme').count()).toBe(0)
    expect(await page.locator('style').count()).toBe(0)
    await page.close()
  })
})
