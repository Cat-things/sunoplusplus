# Now playing in the tab title

Shows the song that's playing in the browser tab, or in Suno Desktop's title bar:

```
♪ Neon Rain — Cat
```

When you pause or stop, Suno's own title comes back (unless **Keep it while paused** is on, which shows `❚❚ Neon Rain — Cat`).

## Settings

| Setting              | Default | What it does                             |
| -------------------- | ------- | ---------------------------------------- |
| Show the artist      | On      | Adds `— Artist` after the song title     |
| Keep it while paused | Off     | Keeps the song in the title while paused |
| Symbol               | ♪ Note  | The symbol in front: ♪, ▶ or nothing     |

## How it works

It listens to `ctx.onSongChanged` and `ctx.onPlaybackStateChanged` (which come from the page's media session, not from Suno's DOM), and watches `<title>` so it can put back whatever title Suno set last. A good first plugin to copy when you make your own.
