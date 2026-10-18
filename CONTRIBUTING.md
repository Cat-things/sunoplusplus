# Contributing to Suno++

Suno++ is built by its community. The most valuable contributions are **plugins and themes**, and you don't need permission to start one: fork, build, open a pull request.

- [Adding a plugin or theme](#adding-a-plugin-or-theme)
- [The rules](#the-rules)
- [What reviewers check](#what-reviewers-check)
- [Updating your plugin or theme](#updating-your-plugin-or-theme)
- [Working on Suno++ itself](#working-on-suno-itself)

Be kind and constructive. Everyone here is doing this for fun.

## Adding a plugin or theme

1. Fork and clone the repo, then:

   ```sh
   pnpm install
   pnpm new plugin my-plugin    # or: pnpm new theme my-theme
   pnpm dev
   ```

2. Load `dist/extension/chrome` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked). After each rebuild, click the reload icon on the Suno++ card, then reload suno.com.
3. Build your thing. Guides: [plugins](docs/PLUGINS.md), [themes](docs/THEMES.md).
4. Fill in `README.md` in your folder: what it does, screenshots, settings.
5. Run the checks:

   ```sh
   pnpm validate && pnpm lint && pnpm typecheck
   ```

6. Open a pull request. One plugin or theme per pull request, please.

Not a coder? Share ideas in [Plugin ideas](https://github.com/Cat-things/suno-desktop/discussions/categories/plugin-ideas) or [Theme ideas](https://github.com/Cat-things/suno-desktop/discussions/categories/theme-ideas) and someone may build it.

## The rules

Suno++ runs on suno.com while people are signed in. These rules keep that safe and keep Suno++ welcome on Suno.

**Never allowed**

- Getting around credits, paywalls, rate limits or anything else Suno charges for or restricts.
- Automating generations or other actions in bulk (bots, auto-clickers, mass downloads).
- Collecting, sending or selling data about users, their songs or their account. No analytics or tracking.
- Loading or running code that isn't in your folder: no `eval`, `new Function`, remote scripts, `import()` or injecting `<script>` tags.
- Talking to servers other than suno.com unless that's the plugin's clear, stated purpose, it is described in its README and the user turns it on. (Reviewers will look hard at any network use.)
- Hiding what the plugin does, obfuscated or minified code, or anything malicious.
- Impersonating Suno: no Suno logos and no wording that suggests your plugin is official.

**Expected**

- Plugins do what their name and description say, and nothing else.
- Everything stays off until the user turns it on (`enabledByDefault` stays `false` for community plugins).
- Write into Suno's inputs the way a user would (`setInputValue` from the SDK), so Suno's own checks still run.
- Clean up: anything registered through `ctx` is cleaned up for you; undo anything else in your cleanup function.
- Be gentle on the page: use `onElement` or a scoped `observe` instead of tight polling loops.

### Licenses

Your folder ships inside the MIT-licensed extension, so it must use one of: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `Unlicense`, `CC0-1.0`. Only submit work you have the right to share. Fonts and images inlined in themes need a compatible license too.

## What reviewers check

`pnpm validate` and CI check most of the rules automatically: manifest format, folder layout, suno.com-only patterns, allowed imports, theme CSS rules, file sizes, license. A human reviewer then checks:

- [ ] It does what the README says, and the README has screenshots for anything visible.
- [ ] It follows [the rules](#the-rules), especially around credits, automation, data and network use.
- [ ] The code is readable, and it's clear why each Suno selector or DOM change is needed.
- [ ] It cleans up after itself when turned off (try toggling it a few times).
- [ ] It doesn't break Suno or other plugins, and errors are handled.
- [ ] Settings have clear labels and sensible defaults.

## Updating your plugin or theme

You own your folder. Open a pull request with your change and bump `version` in `manifest.json` (`1.0.0` → `1.0.1` for fixes, `1.1.0` for new features, `2.0.0` when settings change in a way users would notice). If Suno changes its site and breaks your plugin, a quick fix PR is very welcome, from you or anyone else.

Plugins that stay broken for a long time, or whose authors disappear, may be fixed by others or removed.

## Working on Suno++ itself

Changes to the SDK, runtime, extension or build are welcome too. Open an issue first for anything big so we can agree on the approach.

- `pnpm test` (unit), `pnpm build && xvfb-run -a pnpm test:e2e` (end-to-end, `xvfb-run` only on Linux).
- The SDK (`packages/sdk`) and manifest format (`packages/core/src/schema.ts`) are the contract with every plugin and theme: change them in backwards-compatible ways, and bump `API_VERSION` or `MANIFEST_VERSION` when you can't.
- Keep the core free of Suno DOM selectors; those belong in plugins and themes.
- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.
