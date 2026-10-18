# Neon accents

A small starter theme: text selection, focus rings, scrollbars, sliders and the text cursor take on a color you pick (hot pink by default).

It only uses selectors that don't depend on Suno's markup (`::selection`, `:focus-visible`, `accent-color`, `scrollbar-color`), so it keeps working when Suno updates its site. Copy it to start your own theme, then target Suno's pages for bigger changes.

## Colors

| Variable    | Default   | Used for                        |
| ----------- | --------- | ------------------------------- |
| `accent`    | `#ff2e97` | Selection, focus, scrollbars    |
| `on-accent` | `#ffffff` | Text on top of the accent color |

In `theme.css` they are `var(--spp-accent)` and `var(--spp-on-accent)`.
