/**
 * Starts a new plugin or theme:
 *
 *   pnpm new plugin my-plugin
 *   pnpm new theme my-theme
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { scaffold } from './lib/scaffold.ts'

const root = path.resolve(import.meta.dirname, '..')
const [kind, id] = process.argv.slice(2)

if ((kind !== 'plugin' && kind !== 'theme') || !id) {
  console.error('Usage: pnpm new plugin <id>   or   pnpm new theme <id>')
  process.exit(1)
}

let author = 'Your name'
try {
  author = execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim() || author
} catch {
  // No git name configured; the placeholder is fine.
}

try {
  const dir = scaffold(root, kind, id, author)
  const rel = path.relative(root, dir)
  console.log(`Created ${rel}/

Next:
  1. pnpm dev                 builds and rebuilds as you edit
  2. Load dist/extension/chrome as an unpacked extension (chrome://extensions, Developer mode)
  3. Open suno.com, click the Suno++ icon and turn on your ${kind}
  4. pnpm validate            before opening a pull request

Docs: docs/${kind === 'plugin' ? 'PLUGINS' : 'THEMES'}.md`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
