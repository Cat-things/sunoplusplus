/**
 * Content script on https://suno.com/*, in the extension's isolated world. Runs the bundled
 * plugins and themes with the user's choices, and follows changes made in the popup or options
 * page live.
 */
import { catalog } from 'sunoplusplus:catalog'
import { Runtime, createBrowserHost, type UserState } from '@sunoplusplus/runtime'
import { loadState, onStateChanged, pluginStorage } from './storage.ts'

const runtime = new Runtime({ host: createBrowserHost({ storage: pluginStorage }), catalog })

let started = false
let latest: UserState | null = null

onStateChanged((state) => {
  if (started) runtime.setState(state)
  else latest = state
})

loadState().then(
  (state) => {
    runtime.start(latest ?? state)
    started = true
  },
  (error: unknown) => {
    console.error('[Suno++] could not read settings', error)
  }
)
