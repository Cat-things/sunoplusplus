# Making plugins

A plugin is a folder in `plugins/` with three files:

```
plugins/my-plugin/
  manifest.json   what it is, where it runs, its settings
  index.ts        the code
  README.md       what it does, with screenshots
```

Start one with `pnpm new plugin my-plugin`, run `pnpm dev`, and load `dist/extension/chrome` as an unpacked extension. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and the rules.

- [manifest.json](#manifestjson)
- [Settings](#settings)
- [index.ts and the plugin context](#indexts-and-the-plugin-context)
- [DOM helpers](#dom-helpers)
- [Working with Suno's pages](#working-with-sunos-pages)
- [Suno Desktop](#suno-desktop)
- [Debugging](#debugging)

## manifest.json

```json
{
  "$schema": "../../schemas/plugin.schema.json",
  "manifestVersion": 1,
  "id": "style-helper",
  "name": "Style helper",
  "description": "Suggests styles that go well with what you typed.",
  "version": "1.0.0",
  "authors": [{ "name": "Your Name", "github": "your-username" }],
  "license": "MIT",
  "tags": ["create"],
  "matches": ["https://suno.com/create*"],
  "settings": []
}
```

The `$schema` line gives you autocomplete and inline errors in VS Code and most editors.

| Field              | Required | Notes                                                                                           |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `manifestVersion`  | yes      | Always `1` for now.                                                                             |
| `id`               | yes      | Lowercase letters, digits and dashes, 3 to 48 characters. Must match the folder name.           |
| `name`             | yes      | Up to 48 characters. Shown in the Suno++ settings.                                              |
| `description`      | yes      | Up to 200 characters. One or two sentences.                                                     |
| `version`          | yes      | `x.y.z`. Bump it with every change.                                                             |
| `authors`          | yes      | 1 to 10 of `{ "name", "github"? }`.                                                             |
| `license`          | yes      | One of the [allowed licenses](../CONTRIBUTING.md#licenses).                                     |
| `tags`             | no       | Up to 8 lowercase tags, for the future marketplace.                                             |
| `matches`          | no       | Pages to run on. Default `["https://suno.com/*"]`. See below.                                   |
| `settings`         | no       | Up to 30 settings. See [Settings](#settings).                                                   |
| `enabledByDefault` | no       | Default `false`. Community plugins keep it `false`: users turn plugins on themselves.           |
| `world`            | no       | Only `"isolated"` (the default) is supported. Plugins don't run in Suno's own JavaScript world. |

**`matches`** are patterns where `*` matches anything, compared against the page's address without the `#hash`. They must start with `https://suno.com/`:

| Pattern                    | Matches                                   |
| -------------------------- | ----------------------------------------- |
| `https://suno.com/*`       | every Suno page                           |
| `https://suno.com/create*` | the Create page, with or without `?query` |
| `https://suno.com/song/*`  | song pages                                |

Suno is a single-page app: when the user navigates to a page your patterns don't match, your plugin is stopped and cleaned up; when they come back, it starts again.

## Settings

Declare settings in the manifest and Suno++ renders them in its settings page and popup for you.

```json
"settings": [
  { "key": "showArtist", "type": "boolean", "label": "Show the artist", "default": true },
  { "key": "count", "type": "number", "label": "Suggestions", "default": 5, "min": 1, "max": 10, "step": 1 },
  { "key": "prefix", "type": "string", "label": "Prefix", "default": "♪", "maxLength": 10, "placeholder": "♪" },
  {
    "key": "mode",
    "type": "select",
    "label": "Mode",
    "default": "smart",
    "options": [
      { "value": "smart", "label": "Smart" },
      { "value": "random", "label": "Random" }
    ]
  }
]
```

Every setting has a camelCase `key`, a `label`, an optional `description` and a `default`. Values the user saved that no longer fit (wrong type, out of range, removed option) fall back to the default, so changing your settings in an update never breaks anyone.

## index.ts and the plugin context

`index.ts` default-exports `definePlugin(setup)`. Suno++ calls `setup` with a context (`ctx`) when the plugin is turned on and the page matches, and cleans up when it's turned off or the user leaves those pages.

```ts
import { definePlugin } from '@sunoplusplus/sdk'

interface Settings {
  showArtist: boolean
}

export default definePlugin<Settings>((ctx) => {
  ctx.onSongChanged((song) => {
    if (!song) return
    ctx.log.info(ctx.settings.get('showArtist') ? `${song.title} by ${song.artist}` : song.title)
  })

  // Optional: return a function to undo anything ctx doesn't clean up for you.
  return () => {}
})
```

Pass your settings type to `definePlugin<Settings>` for typed `ctx.settings`. `setup` may be `async`.

| `ctx.`                        | What it does                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`                          | Your plugin id.                                                                                                |
| `env`                         | `{ kind: 'extension' \| 'desktop', desktopVersion?, apiVersion }`.                                             |
| `log.info/warn/error(...)`    | Console logging, prefixed with `[Suno++ your-id]`.                                                             |
| `settings.get(key)`           | Current value of a setting. Throws for keys your manifest doesn't declare.                                     |
| `settings.all()`              | All settings.                                                                                                  |
| `settings.onChange(fn)`       | Called with all settings when the user changes one. No restart needed.                                         |
| `storage.get/set/remove(key)` | Small async key/value storage, private to your plugin. Values must be JSON-serializable.                       |
| `signal`                      | An `AbortSignal` aborted when the plugin stops. Pass it to `addEventListener`, `fetch` and DOM helpers.        |
| `onRoute(fn)`                 | Called right away with `{ url, path }`, then on every navigation.                                              |
| `onSongChanged(fn)`           | Called right away with the current song or `null`, then on every change. `{ title, artist, album, artwork[] }` |
| `onPlaybackStateChanged(fn)`  | Called right away with `'playing' \| 'paused' \| 'none'`, then on every change.                                |
| `addStyle(css)`               | Adds CSS while the plugin runs. Returns a function that removes it.                                            |
| `onCleanup(fn)`               | Runs `fn` when the plugin stops.                                                                               |

Everything registered through `ctx` (listeners, styles, `onCleanup` functions, anything using `ctx.signal`) is undone automatically when your plugin stops. Errors thrown by your code are caught and logged, and never affect other plugins.

The song and playback state come from the page's media session (what Windows and macOS show in their media controls), not from Suno's DOM, so they keep working when Suno redesigns its player.

You can import CSS as a string:

```ts
import styles from './styles.css'

export default definePlugin((ctx) => {
  ctx.addStyle(styles)
})
```

**Imports:** plugins can import `@sunoplusplus/sdk` and files inside their own folder. Nothing else: no npm packages, no other plugins, no `import()`. If you need a small library, copy the parts you use into your folder (with its license).

## DOM helpers

All exported from `@sunoplusplus/sdk`, and all accept `{ signal: ctx.signal }` to clean up by themselves.

```ts
import { definePlugin, el, onElement, setInputValue, waitForElement } from '@sunoplusplus/sdk'

export default definePlugin((ctx) => {
  // Runs for every matching element: the ones there now and any Suno renders later.
  onElement<HTMLTextAreaElement>(
    'textarea[placeholder*="style" i]',
    (box) => {
      const button = el('button', {
        class: 'my-plugin-button',
        text: 'Suggest',
        on: { click: () => setInputValue(box, `${box.value}, dreamy synthwave`) }
      })
      box.after(button)
      ctx.onCleanup(() => button.remove())
    },
    { signal: ctx.signal }
  )
})
```

| Helper                                                   | What it does                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `onElement(selector, fn, { root?, signal? })`            | Calls `fn` once per matching element, now and as new ones appear.                        |
| `waitForElement(selector, { root?, timeout?, signal? })` | Resolves with the first match, waiting if needed. Rejects after `timeout` (10 s).        |
| `observe(node, fn, options?)`                            | A `MutationObserver` that stops with `signal` or the returned function.                  |
| `setInputValue(input, value)`                            | Sets an input or textarea the way typing does, so Suno (React) notices and validates it. |
| `el(tag, { class, text, attrs, on }, ...children)`       | Builds an element without `innerHTML`, so song titles and user text can't inject markup. |
| `matchesUrl(patterns, url)`                              | The same matching the manifest uses.                                                     |

## Working with Suno's pages

Suno changes its site whenever it likes, so the less your plugin depends on its markup, the longer it keeps working.

- Prefer stable hooks: ARIA roles and labels, `placeholder`, `name` and `type` attributes, visible text. Avoid generated class names like `.css-1x2y3z`.
- Re-find elements instead of keeping references: Suno re-renders often. `onElement` does this for you.
- Prefix your own classes and ids with your plugin id (`.style-helper-button`) so they never clash.
- Respect Suno's limits (Styles about 1,000 characters, Lyrics about 5,000, Title 100) and write with `setInputValue`.
- Prefer `ctx.onSongChanged` / `ctx.onPlaybackStateChanged` over reading the player.
- Never automate generations or get around credits or limits. See [the rules](../CONTRIBUTING.md#the-rules).

## Suno Desktop

The same plugin runs inside [Suno Desktop](https://github.com/Cat-things/suno-desktop) without changes. `ctx.env.kind` is `'desktop'` there, and `document.title` is what the app shows in its title bar. Details in [DESKTOP.md](DESKTOP.md).

## Debugging

- Open DevTools on suno.com. Your `ctx.log` output and errors show up in the console, prefixed with your plugin id.
- After `pnpm dev` rebuilds, reload the extension on `chrome://extensions` and then reload suno.com.
- Toggle your plugin on and off a few times in the popup and check that nothing is left behind.
- `pnpm validate` explains anything CI would reject.
