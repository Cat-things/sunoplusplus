# Suno++ in Suno Desktop

[Suno Desktop](https://github.com/Cat-things/suno-desktop) already has the seams Suno++ needs (see its [PLUGIN_HOOKS.md](https://github.com/Cat-things/suno-desktop/blob/main/docs/PLUGIN_HOOKS.md)): an injection pipeline that runs scripts in an isolated plugin world on suno.com, and the read-only `window.sunoDesktop` bridge with route, song and playback events. Suno++ builds a bundle for exactly that. This page is the contract between the two projects.

Suno Desktop downloads Suno++ from this repository's releases and keeps it up to date by itself, so new and updated plugins and themes reach the app as soon as they're merged here, without a new Suno Desktop version.

## Releases

Every push to `main` that changes plugins, themes or Suno++ itself runs `.github/workflows/release.yml`, which builds with the next version (last `vX.Y.Z` tag + 1 patch) and publishes a GitHub Release with:

```
desktop.json                    what the app's updater reads (below)
sunoplusplus.js                 the runtime plus every plugin and theme, one classic script (IIFE)
catalog.json                    every plugin and theme manifest (same as registry.json)
registry.json                   the public index, for the future marketplace
sunoplusplus-chrome-X.Y.Z.zip   the browser extension
sunoplusplus-firefox-X.Y.Z.zip
```

`pnpm build` produces the same files in `dist/desktop/`.

### desktop.json

```json
{
  "formatVersion": 1,
  "version": "0.1.3",
  "bridgeApi": 1,
  "minDesktopVersion": "0.1.0",
  "files": {
    "bundle": { "name": "sunoplusplus.js", "size": 23196, "sha256": "8ab2…" },
    "catalog": { "name": "catalog.json", "size": 2512, "sha256": "64c4…" }
  }
}
```

| Field               | Meaning                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `formatVersion`     | Format of this file. The app ignores releases with a format it doesn't know.                 |
| `version`           | The release's version; its files live under the `v<version>` tag.                            |
| `bridgeApi`         | Oldest `window.sunoDesktop` bridge API the bundle needs.                                     |
| `minDesktopVersion` | Oldest Suno Desktop that can run it. Older apps keep their current Suno++ and ask to update. |
| `files`             | Size and SHA-256 of each file. The app refuses files that don't match.                       |

## How the app loads it

1. **Download and verify.** When the user turns Suno++ on (and then every few hours, if automatic updates are on), the app reads `https://github.com/Cat-things/sunoplusplus/releases/latest/download/desktop.json`, and if the version is newer and compatible, downloads `sunoplusplus.js` and `catalog.json` from `https://github.com/Cat-things/sunoplusplus/releases/download/v<version>/`. It builds those URLs itself (never from the file), checks sizes and SHA-256 hashes, and only then replaces its copy in its user data folder. A failed or partial download leaves the working copy alone.
2. **Keep the user's choices in the app's settings**, in this shape (the bundle validates it, so a missing or bad value just means "nothing on"):

   ```ts
   interface UserState {
     enabled: Record<string, boolean> // plugin id → on/off (missing = the manifest's enabledByDefault)
     settings: Record<string, Record<string, unknown>> // plugin id → setting key → value
     theme: string | null // active theme id
     themeVariables: Record<string, Record<string, unknown>> // theme id → variable key → #rrggbb
   }
   ```

3. **Register one injection entry**, and register it again whenever the state changes:

   ```ts
   injection.register({
     id: 'sunoplusplus.runtime',
     owner: 'sunoplusplus',
     matches: ['https://suno.com/*'],
     world: 'isolated',
     runOn: ['load'],
     js: `globalThis.__SUNOPLUSPLUS_DESKTOP__ = ${JSON.stringify({ state })};\n${bundle}`
   })
   ```

   Re-registering runs the script again on the open page. The bundle finds what the previous run left under `Symbol.for('sunoplusplus.runtime')`:

   - **Same version:** it hands the running runtime the new state, so plugins turn on and off and themes switch without a reload.
   - **Different version** (the app installed an update): it takes the current song and playback state from the old runtime, stops it, and starts the new one with that handover. No reload, so the music keeps playing.

   `__SUNOPLUSPLUS_DESKTOP__` lives in the isolated world and is never visible to suno.com.

4. **Fill the hosts from `catalog.json`:**
   - `PluginHost.available = true`; `list()` maps `catalog.plugins` and `state.enabled`; `load(id)` / `unload(id)` flip `state.enabled[id]` and re-register.
   - `ThemeHost.available = true`; `list()` maps `catalog.themes`; `apply(id | null)` sets `state.theme` and re-registers. Theme CSS travels inside the same bundle, so the `theme` injection owner is not needed.
   - The Settings window's Plugins and Themes tabs can render each plugin's `settings` and each theme's `variables` from the manifests, the same way the extension's options page does (`packages/extension/src/options.ts`).

5. **Deep links:** everything in the catalog is already bundled, so `suno-desktop://plugin/install?id=<id>` and `suno-desktop://theme/install?id=<id>` mean "turn this on". Confirm with the user first, and ignore ids that aren't in `catalog.json`.

## Turning Suno++ off

The app can't take back a script that already ran, so when the user turns Suno++ off it unregisters the injection entry and runs this once in the plugin world of the open page:

```js
const key = Symbol.for('sunoplusplus.runtime')
const installed = globalThis[key]
if (installed) {
  globalThis[key] = undefined
  installed.runtime?.stop?.()
  installed.dispose?.()
}
```

This relies on what the bundle leaves under `Symbol.for('sunoplusplus.runtime')`: an object with `version`, `runtime.stop()`, `dispose()` and `current()`. Keep those names working in future versions, or older Suno Desktop builds won't be able to turn Suno++ off without a reload. Stopping removes every plugin's changes and the theme; nothing runs on later page loads.

## Trust model

The downloaded bundle runs on suno.com in the app's isolated plugin world: it can do what a browser extension on suno.com could do (read and change Suno's pages while the user is signed in), but it gets no Node, no IPC and nothing outside suno.com. Updates are as trustworthy as this repository's releases, the same model as the app's own updater: HTTPS from GitHub, files checked against the hashes in `desktop.json`. Everything in a release went through review here first. Signing releases with a key the app pins would add protection against a compromised release, and is a good next step.

## What the bundle needs from the app

- The bridge in the plugin world with `apiVersion >= 1` and the capabilities `desktop`, `events.routeChanged`, `events.songChanged` and `events.playbackStateChanged`. Suno Desktop 0.1.0 and later have them. Without the bridge the bundle logs a warning and does nothing.
- Nothing else: no IPC, no Node, no extra permissions.

## Differences from the extension

|                                | Extension                                                    | Suno Desktop                                                                                        |
| ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Who stores the user's choices  | `chrome.storage.local`                                       | the app's settings                                                                                  |
| Plugin storage (`ctx.storage`) | `chrome.storage.local`                                       | suno.com `localStorage`, keys `sunoplusplus:plugin:<id>:…` (cleared by the app's **Clear session**) |
| Routes, song, playback         | watched by the content script and the page-world media probe | the app's bridge                                                                                    |
| `ctx.env.kind`                 | `extension`                                                  | `desktop` (with `desktopVersion`)                                                                   |

## Ideas for later

- A bridge capability for per-plugin storage through IPC, so plugin data survives **Clear session**.
- An `appearance` capability on the bridge (the app's Light / Dark / Auto) so themes can follow the app.
- Letting Suno++ themes restyle the app's own title bar through a small set of color tokens.
