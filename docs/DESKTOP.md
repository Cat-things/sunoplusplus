# Suno++ in Suno Desktop

[Suno Desktop](https://github.com/Cat-things/suno-desktop) already has the seams Suno++ needs (see its [PLUGIN_HOOKS.md](https://github.com/Cat-things/suno-desktop/blob/main/docs/PLUGIN_HOOKS.md)): an injection pipeline that runs scripts in an isolated plugin world on suno.com, and the read-only `window.sunoDesktop` bridge with route, song and playback events. Suno++ builds a bundle for exactly that. This page is the contract between the two projects.

**Status:** the bundle is built and tested here against a fake bridge (`tests/e2e/extension.e2e.ts`). Suno Desktop's plugin and theme hosts are still stubs; wiring them to this bundle is the next step on the app side.

## What `pnpm build` produces

```
dist/desktop/sunoplusplus.js   the runtime plus every plugin and theme, one classic script (IIFE)
dist/desktop/catalog.json      every plugin and theme manifest (same as dist/registry.json)
```

## How the app should load it

1. **Ship a pinned build with the app.** Vendor `sunoplusplus.js` and `catalog.json` from a tagged Suno++ release into the app's resources at build time, and update them with app updates. Don't download code at runtime.
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

   Re-registering runs the script again on the open page. The bundle notices the runtime from the previous run (kept under `Symbol.for('sunoplusplus.runtime')`) and hands it the new state instead of starting another one, so plugins turn on and off and themes switch without a reload. `__SUNOPLUSPLUS_DESKTOP__` lives in the isolated world and is never visible to suno.com.

4. **Fill the hosts from `catalog.json`:**
   - `PluginHost.available = true`; `list()` maps `catalog.plugins` and `state.enabled`; `load(id)` / `unload(id)` flip `state.enabled[id]` and re-register.
   - `ThemeHost.available = true`; `list()` maps `catalog.themes`; `apply(id | null)` sets `state.theme` and re-registers. Theme CSS travels inside the same bundle, so the `theme` injection owner is not needed.
   - The Settings window's Plugins and Themes tabs can render each plugin's `settings` and each theme's `variables` from the manifests, the same way the extension's options page does (`packages/extension/src/options.ts`).

5. **Deep links:** everything in the catalog is already bundled, so `suno-desktop://plugin/install?id=<id>` and `suno-desktop://theme/install?id=<id>` mean "turn this on". Confirm with the user first, and ignore ids that aren't in `catalog.json`.

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
