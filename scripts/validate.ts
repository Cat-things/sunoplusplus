/**
 * Checks every plugin and theme the way CI does: manifests, folder layout, theme CSS rules,
 * imports, and that the JSON schemas are up to date. Run it before opening a pull request.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'
import { extensionBuildOptions, root, schemaFiles } from './build.ts'
import { loadCatalog } from './lib/catalog.ts'

const errors: string[] = []
const catalog = loadCatalog(root)
errors.push(...catalog.errors)

for (const [file, contents] of Object.entries(schemaFiles())) {
  const full = path.join(root, file)
  if (!existsSync(full) || readFileSync(full, 'utf8') !== contents) {
    errors.push(`${file} is out of date; run pnpm build and commit it`)
  }
}

if (catalog.errors.length === 0) {
  // A dry bundle catches imports the guard rejects and syntax errors, without writing anything.
  try {
    await esbuild.build({ ...extensionBuildOptions(false), logLevel: 'silent' })
  } catch (error) {
    const failure = error as { errors?: { text: string }[] }
    for (const e of failure.errors ?? [{ text: String(error) }]) errors.push(e.text)
  }
}

if (errors.length > 0) {
  console.error(
    `✗ ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n${errors.map((e) => `  - ${e}`).join('\n')}`
  )
  process.exit(1)
}
console.log(`✓ ${catalog.plugins.length} plugin(s) and ${catalog.themes.length} theme(s) look good`)
for (const p of catalog.plugins) console.log(`  plugin  ${p.manifest.id}@${p.manifest.version}`)
for (const t of catalog.themes) console.log(`  theme   ${t.manifest.id}@${t.manifest.version}`)
