# Making themes

A theme is a folder in `themes/` with three files:

```
themes/my-theme/
  manifest.json   what it is and the colors users can tweak
  theme.css       the styles
  README.md       what it looks like, with screenshots
```

Start one with `pnpm new theme my-theme`, run `pnpm dev`, load `dist/extension/chrome` as an unpacked extension, open suno.com and pick your theme in the Suno++ popup. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and the rules.

Only one theme is active at a time, and "Suno's own look" is always one click away.

## manifest.json

```json
{
  "$schema": "../../schemas/theme.schema.json",
  "manifestVersion": 1,
  "id": "midnight",
  "name": "Midnight",
  "description": "Deep blue surfaces and soft violet highlights.",
  "version": "1.0.0",
  "authors": [{ "name": "Your Name", "github": "your-username" }],
  "license": "MIT",
  "tags": ["dark", "blue"],
  "appearance": "dark",
  "variables": [
    { "key": "accent", "label": "Accent", "type": "color", "default": "#8b5cf6" },
    { "key": "surface", "label": "Background", "type": "color", "default": "#0b1020" }
  ]
}
```

Theme manifests share `manifestVersion`, `id`, `name`, `description`, `version`, `authors`, `license`, `tags` and `matches` with [plugins](PLUGINS.md#manifestjson), plus:

| Field        | Default         | Notes                                                                                                      |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `appearance` | `any`           | `dark`, `light` or `any`. Shown as a badge so people know what they're picking.                            |
| `variables`  | `[]`            | Up to 20 colors the user can change. Each has a `key`, `label`, `type: "color"` and a `#rrggbb` `default`. |
| `matches`    | all of suno.com | Limit the theme to some pages, e.g. `["https://suno.com/create*"]`.                                        |

## theme.css

Each variable becomes a CSS custom property named `--spp-<key>`, with the user's color or your default:

```css
::selection {
  background: var(--spp-accent);
}

body {
  background: var(--spp-surface) !important;
}
```

The theme's CSS is added at the end of `<head>` and moved back there when Suno loads more styles, so with equal specificity your rules win. You'll still need `!important` or more specific selectors to beat some of Suno's styles.

### What theme CSS can't do

Themes only style the page. `pnpm validate` rejects:

- `@import`: put everything in `theme.css`.
- `url(...)` to anything but a `data:` URL: themes can't load images, fonts or anything else from the network (that could track people). Inline small images and fonts as `data:` URLs (keep the file under 200 KB, and check the font's license).
- CSS that runs code (`expression()`, `javascript:`, `-moz-binding`, `behavior:`).

## Styling Suno well

Suno updates its site often. Themes that survive those updates:

- Start from selectors that never change: `html`, `body`, `::selection`, `:focus-visible`, `::placeholder`, scrollbars, `accent-color`, form elements.
- Then use stable hooks: ARIA roles and labels (`[role="dialog"]`, `[aria-label="Play"]`), `placeholder`, `type` and `name` attributes, and `:has()` for structure.
- Avoid generated class names like `.css-1x2y3z` and long descendant chains.
- Check your theme on the Create page, the library, a song page, the player and any open menus or dialogs.
- Keep text readable: check contrast for body text, muted text and text on your accent color.

[Neon accents](../themes/neon-accents) is a small, durable starter: copy it and build up.

## Light, dark and Suno Desktop

Set `appearance` to what your theme is designed for. A theme that works in both can use `@media (prefers-color-scheme: dark)`. In [Suno Desktop](https://github.com/Cat-things/suno-desktop) themes run unchanged on top of the app's own Light / Dark / Auto setting, which styles the app's window, not suno.com.
