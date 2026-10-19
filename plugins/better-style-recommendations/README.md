# Better Style recommendations

Click the **wand** in the Styles box on the Create page (the blue button whose tooltip says _Personalize style prompt to match your taste_) and get style ideas that build on what you've already typed, instead of starting over:

```
You typed:   synthwave, female vocals
Ideas:       darksynth, nocturnal, analog synths, gated reverb drums, lush reverb, 104 bpm
             chillwave, neon, arpeggiated bass, 80s production, 98 bpm
```

Pick one with **Use** and it's added to the box (or replaces it, see settings). **More ideas** shuffles, **Esc** closes, and **Shift+click** the wand to get Suno's own wand instead.

Ideas come from built-in notes on 30+ genres (sub-genres, moods, instruments, vocals, production, tempo). Everything runs on your computer: nothing is sent anywhere, and it never generates songs for you. Tags already in the box are never repeated, and the box stays within Suno's 1,000-character limit.

## Settings

| Setting                | Default             | What it does                                                        |
| ---------------------- | ------------------- | ------------------------------------------------------------------- |
| Suggestions            | 5                   | How many ideas to show (3 to 10)                                    |
| When you pick one      | Add to what's there | Or replace the styles with the genre plus the idea                  |
| Wand button (advanced) | empty               | A CSS selector for Suno's wand if automatic detection stops working |

## If the wand stops working

Suno changes its site from time to time. The plugin recognizes the wand by its tooltip text and icon, and leaves the buttons next to it (library, refresh) alone. If Suno removes that toolbar entirely, a small ✨ button appears next to the Styles box instead. If the wand isn't picked up, set **Wand button (advanced)** to a selector for it (right-click the wand → Inspect), and please [open an issue](https://github.com/Cat-things/sunoplusplus/issues) so it can be fixed for everyone.
