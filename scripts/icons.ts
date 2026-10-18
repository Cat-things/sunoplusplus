/** Renders packages/extension/icons/icon.svg to the PNG sizes the extension manifest uses. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const dir = path.resolve(import.meta.dirname, '../packages/extension/icons')
const svg = readFileSync(path.join(dir, 'icon.svg'), 'utf8')

for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(path.join(dir, `icon-${size}.png`), png)
  console.log(`icon-${size}.png`)
}
