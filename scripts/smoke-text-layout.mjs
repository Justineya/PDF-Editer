#!/usr/bin/env node
/** Regression: CJK address wrap must not orphan「座」; natural width fits one ZH line. */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const layoutUrl = pathToFileURL(join(root, 'apps/web/src/pdf/textLayout.ts')).href
const { layoutTextBlock, wrapParagraph, measureLineWidth } = await import(layoutUrl)

const copy = JSON.parse(readFileSync(join(root, 'samples/phase1/address-copy.json'), 'utf8'))
const zh = copy.zh || String(copy.block).split('\n')[0]
const size = 8

const natural = layoutTextBlock(`${zh}\n${copy.pt || ''}`, size)
if (natural.lines.some((l) => l === '座')) {
  console.error('FAIL natural layout orphaned 座', natural.lines)
  process.exit(1)
}

// Force a slightly-too-narrow box — orphan repair should not leave lone 座
const tight = measureLineWidth(zh, size) - size * 0.5
const wrapped = wrapParagraph(zh, size, tight)
if (wrapped.length && wrapped[wrapped.length - 1] === '座') {
  console.error('FAIL orphan 座 after wrap', wrapped)
  process.exit(1)
}

const laid = layoutTextBlock(copy.block || `${zh}\nline2`, size, Math.max(natural.w, 240))
if (laid.lines.length < 2) {
  console.error('FAIL expected multiline block', laid)
  process.exit(1)
}

console.log('OK  natural.w=', natural.w.toFixed(1), 'lines=', natural.lines.length)
console.log('OK  wrap lines=', wrapped)
console.log('PASS')
