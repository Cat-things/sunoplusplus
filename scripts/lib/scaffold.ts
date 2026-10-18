import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type Kind = 'plugin' | 'theme'

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function checkId(id: string): string | null {
  if (id.length < 3 || id.length > 48) return 'ids are 3 to 48 characters long'
  if (!ID.test(id)) return 'use lowercase letters, digits and single dashes, e.g. "style-helper"'
  return null
}

function titleOf(id: string): string {
  const words = id.split('-').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function pluginFiles(id: string, name: string, author: string): Record<string, string> {
  return {
    'manifest.json': `${JSON.stringify(
      {
        $schema: '../../schemas/plugin.schema.json',
        manifestVersion: 1,
        id,
        name,
        description: 'Describe what your plugin does in one or two sentences.',
        version: '0.1.0',
        authors: [{ name: author }],
        license: 'MIT',
        matches: ['https://suno.com/*'],
        settings: [
          { key: 'greeting', type: 'string', label: 'Greeting', default: 'Hello from Suno++' }
        ]
      },
      null,
      2
    )}\n`,
    'index.ts': `import { definePlugin } from '@sunoplusplus/sdk'

interface Settings {
  greeting: string
}

export default definePlugin<Settings>((ctx) => {
  ctx.log.info(ctx.settings.get('greeting'))

  // Called right away with the current page, then on every navigation.
  ctx.onRoute((route) => {
    ctx.log.info('now on', route.path)
  })

  // Anything registered through ctx is cleaned up when the plugin is turned off.
  // Return a function to clean up anything else.
  return () => {
    ctx.log.info('bye')
  }
})
`,
    'README.md': `# ${name}

What your plugin does, in a few sentences. Screenshots help.

## Settings

| Setting  | Default           | What it does         |
| -------- | ----------------- | -------------------- |
| Greeting | Hello from Suno++ | Logged when it starts |
`
  }
}

function themeFiles(id: string, name: string, author: string): Record<string, string> {
  return {
    'manifest.json': `${JSON.stringify(
      {
        $schema: '../../schemas/theme.schema.json',
        manifestVersion: 1,
        id,
        name,
        description: 'Describe the look of your theme in one or two sentences.',
        version: '0.1.0',
        authors: [{ name: author }],
        license: 'MIT',
        appearance: 'any',
        variables: [{ key: 'accent', label: 'Accent', type: 'color', default: '#8b5cf6' }]
      },
      null,
      2
    )}\n`,
    'theme.css': `/* ${name}. var(--spp-accent) is the "accent" color from manifest.json. */

::selection {
  background: var(--spp-accent);
}
`,
    'README.md': `# ${name}

What your theme looks like, in a few sentences. Screenshots help a lot.
`
  }
}

/** Creates plugins/<id>/ or themes/<id>/ with starter files. Returns the folder. */
export function scaffold(root: string, kind: Kind, id: string, author: string): string {
  const problem = checkId(id)
  if (problem) throw new Error(`"${id}" is not a valid id: ${problem}`)
  const dir = path.join(root, kind === 'plugin' ? 'plugins' : 'themes', id)
  if (existsSync(dir)) throw new Error(`${path.relative(root, dir)} already exists`)
  const files =
    kind === 'plugin' ? pluginFiles(id, titleOf(id), author) : themeFiles(id, titleOf(id), author)
  mkdirSync(dir, { recursive: true })
  for (const [file, contents] of Object.entries(files))
    writeFileSync(path.join(dir, file), contents)
  return dir
}
