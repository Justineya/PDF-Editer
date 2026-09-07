#!/usr/bin/env node
/** Regression: multiline Macau address export must not mash lines onto one baseline. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const { PDFDocument, rgb } = await import(
  pathToFileURL(join(root, 'apps/web/node_modules/pdf-lib/dist/pdf-lib.esm.js')).href
)
const fontkit = (
  await import(
    pathToFileURL(join(root, 'apps/web/node_modules/@pdf-lib/fontkit/dist/fontkit.es.js')).href
  )
).default

const copy = JSON.parse(readFileSync(join(root, 'samples/phase1/address-copy.json'), 'utf8'))
const fontDir = join(root, 'assets/fonts/tc')
const fontFiles = new Map()
for (const name of readdirSync(fontDir)) {
  if (!/\.(otf|ttf)$/i.test(name)) continue
  fontFiles.set(name, new Uint8Array(readFileSync(join(fontDir, name))))
}
function resolve(id) {
  const order =
    id === 'tc-regular'
      ? ['SourceHanSansTC-Regular.otf', 'SourceHanSansTC-Regular.subset.otf']
      : ['SourceHanSansTC-Light.otf']
  for (const n of order) {
    const b = fontFiles.get(n)
    if (b && b.byteLength > 1000) return b
  }
  throw new Error(id)
}

// Simulate ops.drawOverlays multiline baseline math
const pageH = 842
const size = 8
const lineHeight = size * 1.25
const t = { x: 120, y: 100, text: copy.block, fontSize: size }
const lines = String(t.text).split(/\r?\n/).filter(Boolean)
const pdfYs = lines.map((_, i) => {
  const baselineScreenY = t.y + size * 0.9 + i * lineHeight
  return pageH - baselineScreenY
})

const gaps = []
for (let i = 1; i < pdfYs.length; i++) gaps.push(pdfYs[i - 1] - pdfYs[i])
const okGaps = gaps.every((g) => Math.abs(g - lineHeight) < 0.01)
if (!okGaps || lines.length < 3) {
  console.error('FAIL line baselines', { pdfYs, gaps, lineHeight, lines: lines.length })
  process.exit(1)
}
console.log('OK  multiline baselines spaced by', lineHeight, 'pdfYs=', pdfYs.map((y) => y.toFixed(1)))

// Real embed draw — ensure newlines don't throw / collapse
const pdf = await PDFDocument.create()
pdf.registerFontkit(fontkit)
const page = pdf.addPage([595, pageH])
page.drawRectangle({ x: 100, y: pageH - 160, width: 400, height: 70, color: rgb(1, 1, 1) })
const font = await pdf.embedFont(resolve('tc-regular'), { subset: true })
lines.forEach((line, i) => {
  const baselineScreenY = t.y + size * 0.9 + i * lineHeight
  page.drawText(line, {
    x: t.x,
    y: pageH - baselineScreenY,
    size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
})
mkdirSync(join(root, 'artifacts/phase1'), { recursive: true })
const out = join(root, 'artifacts/phase1/P1-multiline-export.pdf')
writeFileSync(out, await pdf.save())
console.log('OK  wrote', out)
console.log('PASS')
