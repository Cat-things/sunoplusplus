/**
 * Style suggestions that fit what's already in the Styles box. Everything runs locally from the
 * genre notes below: no network, no AI service. A suggestion is a handful of tags that add
 * something the box doesn't have yet (a sub-genre, mood, instruments, vocals, production, tempo).
 */

interface Genre {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly styles: readonly string[]
  readonly moods: readonly string[]
  readonly instruments: readonly string[]
  readonly vocals: readonly string[]
  readonly production: readonly string[]
  readonly bpm: readonly [number, number]
}

const GENRES: readonly Genre[] = [
  {
    name: 'pop',
    styles: ['synth-pop', 'dance-pop', 'indie pop', 'electropop', 'dream pop'],
    moods: ['catchy', 'uplifting', 'bittersweet', 'euphoric'],
    instruments: ['bright synths', 'punchy drums', 'plucked guitar', 'sub bass'],
    vocals: ['airy female vocals', 'layered harmonies', 'smooth male vocals'],
    production: ['polished mix', 'sidechained pads', 'big chorus'],
    bpm: [96, 124]
  },
  {
    name: 'rock',
    styles: ['alternative rock', 'indie rock', 'garage rock', 'arena rock', 'post-rock'],
    moods: ['driving', 'raw', 'anthemic', 'nostalgic'],
    instruments: ['distorted guitars', 'live drums', 'overdriven bass', 'organ'],
    vocals: ['gritty male vocals', 'powerful female vocals', 'gang vocals'],
    production: ['live room sound', 'wide stereo guitars', 'big chorus'],
    bpm: [100, 150]
  },
  {
    name: 'hip hop',
    aliases: ['hip-hop', 'rap'],
    styles: ['boom bap', 'trap', 'conscious hip hop', 'jazz rap', 'drill'],
    moods: ['confident', 'gritty', 'laid-back', 'dark'],
    instruments: ['808 bass', 'dusty samples', 'crisp hi-hats', 'vinyl crackle'],
    vocals: ['rhythmic male rap', 'melodic female rap', 'ad-libs'],
    production: ['hard-hitting drums', 'lo-fi texture', 'tight mix'],
    bpm: [80, 100]
  },
  {
    name: 'trap',
    styles: ['melodic trap', 'dark trap', 'rage', 'emo trap'],
    moods: ['menacing', 'moody', 'hypnotic'],
    instruments: ['rolling hi-hats', 'distorted 808', 'bell melody', 'dark pads'],
    vocals: ['autotuned vocals', 'aggressive rap', 'ad-libs'],
    production: ['heavy low end', 'sparse arrangement'],
    bpm: [130, 150]
  },
  {
    name: 'r&b',
    aliases: ['rnb', 'r and b'],
    styles: ['neo-soul', 'alternative r&b', 'contemporary r&b', '90s r&b'],
    moods: ['sensual', 'smooth', 'late-night', 'intimate'],
    instruments: ['rhodes piano', 'warm bass', 'finger snaps', 'lush pads'],
    vocals: ['silky female vocals', 'falsetto male vocals', 'stacked harmonies'],
    production: ['warm mix', 'swung drums'],
    bpm: [70, 95]
  },
  {
    name: 'soul',
    styles: ['classic soul', 'northern soul', 'neo-soul'],
    moods: ['heartfelt', 'warm', 'joyful'],
    instruments: ['horn section', 'hammond organ', 'tight bass', 'tambourine'],
    vocals: ['powerful soulful vocals', 'call and response backing vocals'],
    production: ['vintage analog warmth', 'live band feel'],
    bpm: [80, 110]
  },
  {
    name: 'funk',
    styles: ['p-funk', 'disco funk', 'nu-funk'],
    moods: ['groovy', 'playful', 'feel-good'],
    instruments: ['slap bass', 'wah guitar', 'clavinet', 'brass stabs'],
    vocals: ['falsetto vocals', 'group chants'],
    production: ['tight pocket', 'dry punchy drums'],
    bpm: [100, 120]
  },
  {
    name: 'edm',
    aliases: ['electronic', 'dance'],
    styles: ['big room', 'future bass', 'progressive house', 'electro house'],
    moods: ['euphoric', 'energetic', 'festival'],
    instruments: ['supersaw leads', 'four-on-the-floor kick', 'risers', 'vocal chops'],
    vocals: ['soaring female vocals', 'vocal chops'],
    production: ['massive drop', 'sidechain compression', 'build-up'],
    bpm: [124, 130]
  },
  {
    name: 'house',
    styles: ['deep house', 'tech house', 'afro house', 'french house', 'melodic house'],
    moods: ['groovy', 'hypnotic', 'sunset'],
    instruments: ['four-on-the-floor kick', 'offbeat hi-hats', 'warm bassline', 'piano stabs'],
    vocals: ['soulful vocal samples', 'breathy female vocals'],
    production: ['rolling groove', 'filter sweeps'],
    bpm: [118, 126]
  },
  {
    name: 'techno',
    styles: ['melodic techno', 'industrial techno', 'minimal techno', 'acid techno'],
    moods: ['dark', 'hypnotic', 'relentless'],
    instruments: ['pounding kick', 'acid 303 bassline', 'modular synths', 'metallic percussion'],
    vocals: ['spoken word samples', 'no vocals'],
    production: ['warehouse reverb', 'driving loop'],
    bpm: [128, 140]
  },
  {
    name: 'trance',
    styles: ['uplifting trance', 'progressive trance', 'psytrance'],
    moods: ['euphoric', 'emotional', 'soaring'],
    instruments: ['supersaw chords', 'arpeggiated synths', 'rolling bassline'],
    vocals: ['ethereal female vocals', 'no vocals'],
    production: ['long breakdown', 'big build-up'],
    bpm: [132, 140]
  },
  {
    name: 'drum and bass',
    aliases: ['dnb', 'd&b', 'drum & bass'],
    styles: ['liquid drum and bass', 'neurofunk', 'jungle'],
    moods: ['energetic', 'rolling', 'atmospheric'],
    instruments: ['breakbeats', 'reese bass', 'amen break', 'atmospheric pads'],
    vocals: ['soulful female vocals', 'mc vocals'],
    production: ['fast breaks', 'deep sub bass'],
    bpm: [170, 176]
  },
  {
    name: 'dubstep',
    styles: ['riddim', 'melodic dubstep', 'brostep'],
    moods: ['heavy', 'aggressive', 'dark'],
    instruments: ['wobble bass', 'growl bass', 'half-time drums'],
    vocals: ['chopped vocals', 'emotional female vocals'],
    production: ['massive drop', 'heavy sub'],
    bpm: [140, 150]
  },
  {
    name: 'lo-fi',
    aliases: ['lofi', 'lo fi'],
    styles: ['lo-fi hip hop', 'chillhop', 'jazzhop'],
    moods: ['chill', 'cozy', 'rainy', 'nostalgic'],
    instruments: ['dusty piano', 'mellow guitar', 'soft kick', 'vinyl crackle'],
    vocals: ['no vocals', 'soft hummed vocals'],
    production: ['tape saturation', 'lazy swing'],
    bpm: [70, 90]
  },
  {
    name: 'jazz',
    styles: ['smooth jazz', 'bebop', 'jazz fusion', 'cool jazz', 'nu jazz'],
    moods: ['sophisticated', 'smoky', 'mellow', 'late-night'],
    instruments: ['upright bass', 'brushed drums', 'tenor saxophone', 'muted trumpet', 'piano'],
    vocals: ['crooning vocals', 'scat vocals', 'no vocals'],
    production: ['live room recording', 'warm analog'],
    bpm: [80, 180]
  },
  {
    name: 'blues',
    styles: ['delta blues', 'chicago blues', 'blues rock'],
    moods: ['soulful', 'gritty', 'melancholic'],
    instruments: ['slide guitar', 'harmonica', 'shuffle drums'],
    vocals: ['raspy vocals', 'soulful vocals'],
    production: ['raw live feel'],
    bpm: [70, 120]
  },
  {
    name: 'country',
    styles: ['modern country', 'outlaw country', 'country pop', 'bluegrass'],
    moods: ['heartfelt', 'nostalgic', 'rowdy'],
    instruments: ['steel guitar', 'fiddle', 'banjo', 'acoustic guitar'],
    vocals: ['twangy male vocals', 'warm female vocals', 'harmonies'],
    production: ['nashville polish', 'stomp and clap'],
    bpm: [80, 120]
  },
  {
    name: 'folk',
    styles: ['indie folk', 'folk rock', 'chamber folk', 'americana'],
    moods: ['intimate', 'earthy', 'melancholic', 'hopeful'],
    instruments: ['fingerpicked acoustic guitar', 'mandolin', 'cello', 'stomp box'],
    vocals: ['gentle vocals', 'close harmonies'],
    production: ['organic', 'room ambience'],
    bpm: [70, 110]
  },
  {
    name: 'metal',
    styles: ['metalcore', 'doom metal', 'thrash metal', 'symphonic metal', 'nu metal'],
    moods: ['aggressive', 'epic', 'brooding'],
    instruments: ['downtuned guitars', 'double kick drums', 'chugging riffs', 'choir'],
    vocals: ['harsh screams', 'clean sung chorus', 'growled vocals'],
    production: ['wall of sound', 'tight drums'],
    bpm: [90, 200]
  },
  {
    name: 'punk',
    styles: ['pop punk', 'post-punk', 'hardcore punk', 'skate punk'],
    moods: ['rebellious', 'fast', 'reckless'],
    instruments: ['power chords', 'fast drums', 'driving bass'],
    vocals: ['shouted vocals', 'snotty vocals', 'gang vocals'],
    production: ['raw', 'loud'],
    bpm: [150, 200]
  },
  {
    name: 'indie',
    styles: ['indie rock', 'indie pop', 'bedroom pop', 'shoegaze'],
    moods: ['dreamy', 'wistful', 'quirky'],
    instruments: ['jangly guitars', 'warm synths', 'tambourine'],
    vocals: ['soft vocals', 'reverb-drenched vocals'],
    production: ['lo-fi charm', 'washed-out reverb'],
    bpm: [90, 130]
  },
  {
    name: 'synthwave',
    aliases: ['retrowave', 'outrun'],
    styles: ['darksynth', 'chillwave', 'outrun'],
    moods: ['nostalgic', 'neon', 'nocturnal'],
    instruments: ['analog synths', 'gated reverb drums', 'arpeggiated bass'],
    vocals: ['dreamy vocals', 'no vocals'],
    production: ['80s production', 'lush reverb'],
    bpm: [90, 120]
  },
  {
    name: 'reggae',
    styles: ['roots reggae', 'dub', 'dancehall', 'reggae fusion'],
    moods: ['laid-back', 'sunny', 'positive'],
    instruments: ['offbeat skank guitar', 'deep bass', 'one drop drums', 'organ bubble'],
    vocals: ['relaxed vocals', 'toasting'],
    production: ['dub echoes', 'spacious mix'],
    bpm: [70, 90]
  },
  {
    name: 'latin',
    styles: ['reggaeton', 'salsa', 'bachata', 'latin pop', 'cumbia'],
    moods: ['sensual', 'festive', 'fiery'],
    instruments: ['dembow rhythm', 'congas', 'brass section', 'nylon guitar'],
    vocals: ['spanish vocals', 'passionate vocals'],
    production: ['tropical', 'punchy percussion'],
    bpm: [90, 105]
  },
  {
    name: 'afrobeats',
    aliases: ['afrobeat', 'amapiano'],
    styles: ['afro-pop', 'amapiano', 'afro-fusion'],
    moods: ['sunny', 'groovy', 'joyful'],
    instruments: ['log drum', 'shakers', 'highlife guitar', 'talking drum'],
    vocals: ['smooth melodic vocals', 'call and response'],
    production: ['bouncy groove', 'warm mix'],
    bpm: [100, 115]
  },
  {
    name: 'k-pop',
    aliases: ['kpop'],
    styles: ['k-pop dance', 'k-pop ballad', 'k-r&b'],
    moods: ['bright', 'bold', 'dynamic'],
    instruments: ['punchy synths', 'heavy bass', 'string hits'],
    vocals: ['group vocals', 'rap verse', 'high-note chorus'],
    production: ['genre-switching bridge', 'glossy mix'],
    bpm: [100, 130]
  },
  {
    name: 'hyperpop',
    styles: ['glitchcore', 'digicore', 'bubblegum bass'],
    moods: ['chaotic', 'sugary', 'frantic'],
    instruments: ['distorted 808s', 'bitcrushed synths', 'glitchy percussion'],
    vocals: ['pitched-up vocals', 'autotuned vocals'],
    production: ['maximalist', 'clipped mix'],
    bpm: [140, 170]
  },
  {
    name: 'phonk',
    styles: ['drift phonk', 'memphis phonk'],
    moods: ['dark', 'aggressive', 'hypnotic'],
    instruments: ['cowbell melody', 'distorted 808', 'memphis vocal samples'],
    vocals: ['chopped vocal samples', 'no vocals'],
    production: ['saturated', 'heavy sidechain'],
    bpm: [130, 160]
  },
  {
    name: 'classical',
    aliases: ['orchestral'],
    styles: ['neoclassical', 'romantic era', 'baroque', 'chamber music'],
    moods: ['majestic', 'tender', 'dramatic'],
    instruments: ['string quartet', 'grand piano', 'solo violin', 'full orchestra'],
    vocals: ['no vocals', 'operatic soprano'],
    production: ['concert hall acoustics', 'dynamic range'],
    bpm: [60, 120]
  },
  {
    name: 'cinematic',
    aliases: ['epic', 'soundtrack', 'score'],
    styles: ['epic orchestral', 'trailer music', 'ambient score'],
    moods: ['epic', 'emotional', 'suspenseful'],
    instruments: ['taiko drums', 'brass swells', 'choir', 'string ostinato'],
    vocals: ['epic choir', 'no vocals'],
    production: ['huge reverb', 'slow build'],
    bpm: [70, 140]
  },
  {
    name: 'ambient',
    styles: ['dark ambient', 'drone', 'new age', 'space ambient'],
    moods: ['calm', 'meditative', 'ethereal'],
    instruments: ['evolving pads', 'field recordings', 'soft piano', 'granular textures'],
    vocals: ['no vocals', 'wordless vocals'],
    production: ['spacious', 'slow evolving'],
    bpm: [50, 80]
  },
  {
    name: 'gospel',
    styles: ['contemporary gospel', 'gospel choir', 'praise and worship'],
    moods: ['uplifting', 'spiritual', 'joyful'],
    instruments: ['hammond organ', 'piano', 'hand claps'],
    vocals: ['gospel choir', 'powerful lead vocals'],
    production: ['live church feel'],
    bpm: [70, 120]
  }
]

const GENERIC = {
  moods: [
    'uplifting',
    'melancholic',
    'dreamy',
    'energetic',
    'nostalgic',
    'dark',
    'romantic',
    'playful'
  ],
  vocals: ['emotive vocals', 'breathy vocals', 'powerful vocals', 'duet', 'harmonies'],
  production: ['polished mix', 'warm analog', 'wide stereo', 'crisp drums', 'atmospheric intro']
}

export type Rng = () => number

/** Small seeded random generator, so tests (and "More ideas") are reproducible. */
export function seeded(seed: number): Rng {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[Math.floor(rng() * items.length)]
  if (item === undefined) throw new Error('nothing to pick from')
  return item
}

export function parseTags(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function has(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text)
}

/** Genres mentioned in the text, in the order they appear in the notes. */
export function detectGenres(text: string): readonly Genre[] {
  return GENRES.filter((g) => [g.name, ...(g.aliases ?? []), ...g.styles].some((w) => has(text, w)))
}

export interface Suggestion {
  /** New tags, in order. */
  readonly tags: readonly string[]
  readonly text: string
}

export interface SuggestOptions {
  readonly current: string
  readonly count: number
  readonly rng?: Rng
}

/**
 * Builds `count` distinct suggestions. Each adds only tags that aren't in the box already; when
 * the box names a genre, suggestions stay in that genre, otherwise they explore different ones.
 */
export function suggestStyles({ current, count, rng = Math.random }: SuggestOptions): Suggestion[] {
  const existing = new Set(parseTags(current).map((t) => t.toLowerCase()))
  const detected = detectGenres(current)
  const hasTempo = /\b\d{2,3}\s*bpm\b/i.test(current)
  const pool = [...GENRES].sort(() => rng() - 0.5)
  const results: Suggestion[] = []
  const seen = new Set<string>()

  for (let attempt = 0; results.length < count && attempt < count * 6; attempt++) {
    const genre = detected.length > 0 ? pick(detected, rng) : pool[attempt % pool.length]
    if (!genre) break
    const candidates = [
      detected.includes(genre) ? null : genre.name,
      pick(genre.styles, rng),
      pick(rng() < 0.75 ? genre.moods : GENERIC.moods, rng),
      pick(genre.instruments, rng),
      pick(genre.instruments, rng),
      pick(rng() < 0.8 ? genre.vocals : GENERIC.vocals, rng),
      pick(rng() < 0.7 ? genre.production : GENERIC.production, rng),
      hasTempo
        ? null
        : `${String(genre.bpm[0] + Math.floor(rng() * (genre.bpm[1] - genre.bpm[0] + 1)))} bpm`
    ]
    const tags: string[] = []
    for (const tag of candidates) {
      if (tag === null) continue
      const key = tag.toLowerCase()
      if (existing.has(key) || tags.some((t) => t.toLowerCase() === key)) continue
      tags.push(tag)
    }
    const text = tags.join(', ')
    if (tags.length < 2 || seen.has(text)) continue
    seen.add(text)
    results.push({ tags, text })
  }
  return results
}

/**
 * The Styles box text after using a suggestion. `add` keeps what's there and appends; `replace`
 * starts over with the genre plus the suggestion. Drops trailing tags to stay within `maxLength`.
 */
export function applySuggestion(
  current: string,
  suggestion: Suggestion,
  mode: 'add' | 'replace',
  maxLength = 1000
): string {
  const base =
    mode === 'add'
      ? parseTags(current)
      : detectGenres(current)
          .slice(0, 1)
          .map((g) => g.name)
  const tags = [...base]
  for (const tag of suggestion.tags) {
    const next = [...tags, tag].join(', ')
    if (next.length > maxLength) break
    tags.push(tag)
  }
  return tags.join(', ')
}
