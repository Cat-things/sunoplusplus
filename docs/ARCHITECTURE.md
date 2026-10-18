# Architecture

## Goals

1. Anyone can make a plugin or theme, and it works in the browser **and** in Suno Desktop unchanged.
2. Nothing runs that wasn't reviewed in this repo, and nothing can reach beyond suno.com.
3. The core has no Suno DOM selectors. When Suno changes its site, a plugin may break; Suno++ doesn't.

## Packages

```
packages/core       pure, no DOM: manifest formats (zod, build time only), URL matching, settings resolution, shared types
packages/sdk        what plugins import: definePlugin, PluginContext types, DOM helpers
packages/runtime    Runtime (runs plugins and the theme), Host interface, browser host, desktop host, UserState
packages/extension  browser extension: content script, page-world media probe, popup and options page
packages/desktop    entry point of the Suno Desktop bundle
plugins/, themes/   the catalog: one reviewed folder per plugin or theme
scripts/            build (esbuild), validate, scaffold, icons
```

zod only runs at build time: the runtime receives manifests that already passed validation, so the content script stays small (about 22 KB, unminified).

## Build

```
plugins/*/manifest.json ─┐
plugins/*/index.ts      ─┼─ scripts/lib/catalog.ts ── validate ──► virtual module "sunoplusplus:catalog"
themes/*/manifest.json  ─┤   (manifests, layout,                     (manifests + plugin code + theme CSS)
themes/*/theme.css      ─┘    CSS rules, sizes, ids)                 "sunoplusplus:catalog-meta" (manifests only)
                                                                          │
                     esbuild (+ import guard: plugins may import only the SDK and their own folder)
                                                                          │
     dist/extension/chrome · dist/extension/firefox · dist/desktop/sunoplusplus.js · dist/registry.json
```

Everything in the catalog is bundled. "Installing" a plugin means turning on code that is already in the reviewed build, which is what makes the extension acceptable to browser stores (no remote code) and safe to run where people are signed in.

## Runtime

```
              Host (browser or desktop)
  route ─┐    reports what happens on the page
  song  ─┼──► Runtime ── reconcile() on every state change and navigation
  play  ─┘      │
UserState ──────┤  for each plugin: enabled? && matches the URL? && DOM ready?
(enabled,       │     start → PluginInstance(setup(ctx))   stop → abort signal, run cleanups
 settings,      │     running → push new settings (no restart)
 theme,         │
 colors)        └─ theme: <style id="sunoplusplus-theme"> = --spp-* variables + theme.css,
                   kept last in <head>, removed when off or when the URL leaves its matches
```

- **PluginInstance** owns a plugin's context: an `AbortController` (`ctx.signal`), the list of cleanups, and its listeners. Stopping aborts the signal and runs cleanups in reverse order. Every call into plugin code is wrapped, so a throwing plugin or listener is logged and the rest carry on; a plugin whose `setup` throws is not retried until it is turned off and on, the user leaves its pages and comes back, or the page reloads.
- **Events** are fanned out by the runtime, not subscribed to the host by each plugin, so on a navigation the runtime first stops plugins that no longer match, then delivers the route to the ones still running. Listeners get the current value when they subscribe.
- **Settings** are stored raw and resolved against the manifest every time (`resolveSettings`), so stale or bad values fall back to defaults.
- The runtime reads route, song, playback and DOM readiness when it **starts**, not when it's created: the extension creates it at `document_start` and starts it after reading storage.

## Hosts

|                | Browser host (`createBrowserHost`)                                                     | Desktop host (`createDesktopHost`)                |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Routes         | Navigation API `currententrychange`, `popstate`, `hashchange`, plus a 500 ms URL check | bridge `routeChanged`                             |
| Song           | `navigator.mediaSession.metadata` (shared by all worlds), polled                       | bridge `songChanged` (validated)                  |
| Playback       | `mediaSession.playbackState`, else the media probe, else media elements in the DOM     | bridge `playbackStateChanged`                     |
| Plugin storage | `chrome.storage.local` (`plugin:<id>:<key>`)                                           | `localStorage` (`sunoplusplus:plugin:<id>:<key>`) |

**The media probe** (`packages/extension/src/media-probe.ts`) is the only code in Suno's own JavaScript world. Suno plays audio through elements that never join the DOM, which the isolated world can't see, so the probe notices `play()` calls and media events and dispatches a `sunoplusplus:media` event with just `playing`, `paused` or `none`. It exposes no API to the page. Suno Desktop doesn't need it: its preload already tracks media in the page world.

## Extension

- `content.js` (isolated world, `document_start`, `https://suno.com/*`): creates the browser host and runtime, reads the state from `chrome.storage.local`, follows `storage.onChanged`.
- `media-probe.js` (main world, `document_start`, `https://suno.com/*`): see above.
- `popup.html` / `options.html` share `options.js`: list the catalog, render settings and theme colors from the manifests, write the state. Built with the SDK's `el()`, never `innerHTML`.
- Permissions: `storage`. No `host_permissions`, no background worker. Firefox gets `browser_specific_settings` with `data_collection_permissions: none`.

## Security model

| Threat                            | Mitigation                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious or careless plugin code | Human review of every folder; plugins run in the isolated world; ESLint bans `eval`, `new Function`, `import()` and extension APIs in plugins             |
| Supply-chain attacks              | Plugins can't import npm packages or anything outside their folder (build-time import guard)                                                              |
| Remote code                       | Everything is bundled; nothing is fetched or evaluated at runtime                                                                                         |
| Running on the wrong pages        | `matches` must start with `https://suno.com/`, checked at build time and again at runtime (`matchesUrl` refuses other origins, including `auth.suno.com`) |
| Tracking through themes           | No `@import`, no non-`data:` URLs, no hostnames, no CSS scripting in theme CSS                                                                            |
| One plugin breaking others        | Every call into plugin code is wrapped; cleanups run even after errors                                                                                    |
| Markup injection from song titles | UI built with `textContent` / `el()`; theme colors must be `#rrggbb` before they reach CSS                                                                |
| Page snooping on Suno++           | No globals in the page world; the desktop config lives in the isolated world                                                                              |

## Testing

- **Unit** (`tests/*.test.ts`, Vitest + happy-dom): manifests and JSON Schemas, URL matching, settings, the runtime (lifecycle, matches across navigation, error isolation, async setup, settings updates, themes, DOM readiness), both hosts, the catalog rules, the scaffold and the extension manifest.
- **End to end** (`tests/e2e/extension.e2e.ts`): loads the built extension into real Chromium with a fake suno.com, drives the options page, checks the plugin and theme live on the page (including audio played outside the DOM via the probe), persistence across reloads, that nothing leaks into the page, and runs the desktop bundle against a fake `window.sunoDesktop`.
