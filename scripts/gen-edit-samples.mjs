#!/usr/bin/env node
/**
 * Generate edit-focused PDF samples for manual / automated QA.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const outDir = join(root, 'samples')
mkdirSync(outDir, { recursive: true })

async function makeLatin() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  const { height } = page.getSize()
  page.drawText('EDIT-SAMPLE-LATIN', {
    x: 48,
    y: height - 56,
    size: 22,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  })
  page.drawText('Replace this sentence with STREAM-EDIT-OK.', {
    x: 48,
    y: height - 100,
    size: 14,
    font,
    color: rgb(0.15, 0.15, 0.15),
  })
  page.drawText('Place a rectangle over the gray box below, then delete it.', {
    x: 48,
    y: height - 130,
    size: 12,
    font,
  })
  page.drawRectangle({
    x: 48,
    y: height - 260,
    width: 220,
    height: 90,
    color: rgb(0.88, 0.9, 0.92),
    borderColor: rgb(0.5, 0.55, 0.6),
    borderWidth: 1,
  })
  page.drawText('TARGET-BOX', {
    x: 60,
    y: height - 210,
    size: 16,
    font: bold,
    color: rgb(0.3, 0.35, 0.4),
  })
  page.drawText('Add text near this line using the Text tool.', {
    x: 48,
    y: height - 300,
    size: 12,
    font,
  })
  page.drawText('Select / drag / Delete must work on new objects.', {
    x: 48,
    y: height - 320,
    size: 12,
    font,
  })
  const bytes = await pdf.save()
  writeFileSync(join(outDir, 'E-edit-latin.pdf'), bytes)
  console.log('wrote E-edit-latin.pdf', bytes.length)
}

async function makeZh() {
  // pdf-lib WinAnsi cannot draw CJK glyphs; embed as Latin labels + note,
  // and also write a second page with placeholder boxes for CJK UI testing.
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595, 842])
  const { height } = page.getSize()
  page.drawText('EDIT-SAMPLE-CJK-UI', {
    x: 48,
    y: height - 56,
    size: 20,
    font: bold,
  })
  page.drawText('This sample is for CJK font UI testing in ForgePDF.', {
    x: 48,
    y: height - 90,
    size: 12,
    font,
  })
  page.drawText('1) Choose font: Heiti / Songti in style bar', {
    x: 48,
    y: height - 130,
    size: 12,
    font,
  })
  page.drawText('2) Place Chinese text with Text tool (screen font)', {
    x: 48,
    y: height - 150,
    size: 12,
    font,
  })
  page.drawText('3) Draw ellipse with fill color over dashed area', {
    x: 48,
    y: height - 170,
    size: 12,
    font,
  })
  page.drawRectangle({
    x: 48,
    y: height - 320,
    width: 260,
    height: 110,
    borderColor: rgb(0.8, 0.2, 0.2),
    borderWidth: 1.5,
    borderDashArray: [6, 4],
  })
  page.drawText('DRAW-ELLIPSE-HERE', {
    x: 70,
    y: height - 260,
    size: 14,
    font: bold,
    color: rgb(0.7, 0.2, 0.2),
  })
  const bytes = await pdf.save()
  writeFileSync(join(outDir, 'E-edit-cjk-ui.pdf'), bytes)
  console.log('wrote E-edit-cjk-ui.pdf', bytes.length)
}

async function makeMixed() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const page = pdf.addPage([612, 792])
  const { height } = page.getSize()
  page.drawText('Contract Excerpt — Edit Stress', {
    x: 48,
    y: height - 56,
    size: 18,
    font: bold,
  })
  const lines = [
    'Party A shall deliver the Goods on or before 2026-09-30.',
    'Payment terms: Net 30 days from invoice date.',
    'This clause is intentionally dense for selection tests.',
    'Use Select tool on overlays; do not create duplicates.',
    'After placing text OBJ-A, select it, move it, then Delete.',
  ]
  lines.forEach((line, i) => {
    page.drawText(line, {
      x: 48,
      y: height - 110 - i * 22,
      size: 12,
      font,
    })
  })
  page.drawRectangle({
    x: 48,
    y: 120,
    width: 500,
    height: 80,
    color: rgb(0.95, 0.95, 0.85),
  })
  page.drawText('Sticky note area — place IMAGE or SHAPE here.', {
    x: 60,
    y: 160,
    size: 12,
    font,
  })
  const bytes = await pdf.save()
  writeFileSync(join(outDir, 'E-edit-mixed.pdf'), bytes)
  console.log('wrote E-edit-mixed.pdf', bytes.length)
}

await makeLatin()
await makeZh()
await makeMixed()
console.log('done')
