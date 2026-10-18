/**
 * Helpers for .github/workflows/release.yml.
 *
 *   node scripts/release.ts version            prints the next version (last vX.Y.Z tag + 1 patch,
 *                                               or package.json's version when it is higher)
 *   node scripts/release.ts notes <version>    prints release notes (Markdown)
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { packageVersion, root } from './build.ts'
import { loadCatalog } from './lib/catalog.ts'

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function parse(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export function nextVersion(lastTag: string | null, pkg: string): string {
  const base = parse(pkg)
  if (!base) throw new Error(`package.json version "${pkg}" must be x.y.z`)
  const last = lastTag ? parse(lastTag) : null
  if (!last) return base.join('.')
  const bumped: [number, number, number] = [last[0], last[1], last[2] + 1]
  return (compare(base, bumped) > 0 ? base : bumped).join('.')
}

function lastTag(): string | null {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', '--exclude', '*-*', 'HEAD')
  } catch {
    return null
  }
}

function notes(version: string): string {
  const previous = lastTag()
  const range = previous ? [`${previous}..HEAD`] : ['HEAD']
  const changes = git('log', '--no-merges', '--pretty=format:- %s (%h)', ...range)
  const catalog = loadCatalog(root)
  const list = (items: { manifest: { name: string; version: string } }[]) =>
    items.map((i) => `- ${i.manifest.name} ${i.manifest.version}`).join('\n') || '- none yet'
  return `## Changes${previous ? ` since ${previous}` : ''}

${changes || '- Maintenance release'}

## In this release

**Plugins**
${list(catalog.plugins)}

**Themes**
${list(catalog.themes)}

## Get it

- **Suno Desktop** picks this up by itself when Suno++ is turned on (Settings → Plugins).
- **Chrome, Edge, Brave:** unzip \`sunoplusplus-chrome-${version}.zip\`, open \`chrome://extensions\`, turn on Developer mode, **Load unpacked**.
- **Firefox:** \`about:debugging#/runtime/this-firefox\` → **Load Temporary Add-on** → pick \`manifest.json\` from \`sunoplusplus-firefox-${version}.zip\`.

Suno++ is unofficial and not affiliated with Suno, Inc.
`
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [command, arg] = process.argv.slice(2)
  if (command === 'version') {
    console.log(nextVersion(lastTag(), packageVersion()))
  } else if (command === 'notes' && arg) {
    process.stdout.write(notes(arg))
  } else {
    console.error('usage: release.ts version | release.ts notes <version>')
    process.exit(1)
  }
}
