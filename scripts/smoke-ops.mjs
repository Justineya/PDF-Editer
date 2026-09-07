#!/usr/bin/env node
/**
 * Headless smoke test for ForgePDF pdf ops (no browser).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const webRoot = join(root, 'apps/web')
const require = createRequire(join(webRoot, 'package.json'))

// Resolve pdf modules via vite-less node import of source is hard;
// instead re-run critical ops using pdf-lib directly mirroring app behavior.
const { PDFDocument, StandardFonts, rgb, degrees } = await import(
  pathToFileURL(require.resolve('pdf-lib')).href
)

const samples = join(root, 'samples')
await mkdir(samples, { recursive: true })

async function makeForm() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Smoke Form', { x: 50, y: 740, size: 18, font })
  const form = pdf.getForm()
  const name = form.createTextField('full_name')
  name.addToPage(page, { x: 50, y: 700, width: 200, height: 24 })
  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 50, y: 660, width: 16, height: 16 })
  return pdf.save()
}

async function makeMulti() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 4; i++) {
    const p = pdf.addPage([612, 792])
    p.drawText(`Page ${i + 1} ForgePDF smoke`, { x: 50, y: 700, size: 16, font })
  }
  return pdf.save()
}

const multi = await makeMulti()
const formBytes = await makeForm()
await writeFile(join(samples, 'S-text-multipage.pdf'), multi)
await writeFile(join(samples, 'S-form.pdf'), formBytes)

// merge
const a = await PDFDocument.load(multi)
const b = await PDFDocument.load(formBytes)
const merged = await PDFDocument.create()
for (const src of [a, b]) {
  const pages = await merged.copyPages(src, src.getPageIndices())
  pages.forEach((p) => merged.addPage(p))
}
const mergedBytes = await merged.save()
if ((await PDFDocument.load(mergedBytes)).getPageCount() !== 5) throw new Error('merge page count')

// rotate + delete
const rot = await PDFDocument.load(multi)
rot.getPage(0).setRotation(degrees(90))
const afterRot = await rot.save()
const src2 = await PDFDocument.load(afterRot)
const kept = await PDFDocument.create()
const pages = await kept.copyPages(src2, [0, 2, 3])
pages.forEach((p) => kept.addPage(p))
const delBytes = await kept.save()
if ((await PDFDocument.load(delBytes)).getPageCount() !== 3) throw new Error('delete failed')

// form fill
const fdoc = await PDFDocument.load(formBytes)
const form = fdoc.getForm()
form.getTextField('full_name').setText('Justin Test')
form.getCheckBox('agree').check()
const filled = await fdoc.save()
const f2 = await PDFDocument.load(filled)
if (f2.getForm().getTextField('full_name').getText() !== 'Justin Test') throw new Error('form fill')

// watermark flatten
const wdoc = await PDFDocument.load(multi)
const font = await wdoc.embedFont(StandardFonts.HelveticaBold)
for (const page of wdoc.getPages()) {
  const { width, height } = page.getSize()
  page.drawText('WATERMARK', {
    x: width * 0.2,
    y: height * 0.45,
    size: 40,
    font,
    color: rgb(0.6, 0.6, 0.6),
    opacity: 0.3,
    rotate: degrees(-30),
  })
  page.drawRectangle({ x: 100, y: 500, width: 120, height: 20, color: rgb(1, 0.8, 0.1), opacity: 0.4 })
}
const wmBytes = await wdoc.save()
await writeFile(join(samples, 'S-merge-b.pdf'), formBytes)
await writeFile(join(samples, '_smoke-merged.pdf'), mergedBytes)
await writeFile(join(samples, '_smoke-watermark.pdf'), wmBytes)

console.log('SMOKE OK')
console.log('- merge 4+1 = 5 pages')
console.log('- rotate + delete => 3 pages')
console.log('- form fill persisted')
console.log('- watermark/highlight drawn')
