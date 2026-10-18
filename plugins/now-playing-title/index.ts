import { definePlugin, observe, type PlaybackState, type Song } from '@sunoplusplus/sdk'

interface Settings {
  showArtist: boolean
  showWhenPaused: boolean
  symbol: string
}

const SYMBOLS: Record<string, string> = { note: '♪ ', play: '▶ ', none: '' }

export default definePlugin<Settings>((ctx) => {
  let song: Song | null = null
  let playback: PlaybackState = 'none'
  // Suno sets its own title on navigation; remember the latest one to put back.
  let sunoTitle = document.title
  let ours: string | null = null

  const render = (): void => {
    const visible =
      song !== null &&
      (playback === 'playing' || (playback === 'paused' && ctx.settings.get('showWhenPaused')))
    if (!song || !visible) {
      if (ours !== null && document.title === ours) document.title = sunoTitle
      ours = null
      return
    }
    const parts = [song.title]
    if (ctx.settings.get('showArtist') && song.artist) parts.push(song.artist)
    const symbol = playback === 'paused' ? '❚❚ ' : (SYMBOLS[ctx.settings.get('symbol')] ?? '')
    const next = `${symbol}${parts.join(' — ')}`
    if (document.title !== next) {
      ours = next
      document.title = next
    }
  }

  const head = document.head as HTMLHeadElement | null
  if (head) {
    observe(
      head,
      () => {
        if (document.title === ours) return
        sunoTitle = document.title
        render()
      },
      { childList: true, subtree: true, characterData: true, signal: ctx.signal }
    )
  }

  ctx.onSongChanged((next) => {
    song = next
    render()
  })
  ctx.onPlaybackStateChanged((next) => {
    playback = next
    render()
  })
  ctx.settings.onChange(render)

  return () => {
    if (ours !== null && document.title === ours) document.title = sunoTitle
  }
})
