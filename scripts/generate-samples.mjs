#!/usr/bin/env node
/**
 * 生成 ForgePDF 验收用样例 PDF（多页文本、表单、空白页）
 * 用法: node scripts/generate-samples.mjs
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'samples')
const require = createRequire(join(root, 'apps/web/package.json'))
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib')
void pathToFileURL

async function makeTextPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([612, 792])
    page.drawText('ForgePDF Sample — Multi-page Text', {
      x: 50,
      y: 740,
      size: 18,
      font: bold,
      color: rgb(0.1, 0.14, 0.2),
    })
    page.drawText(`Page ${i + 1} of 5`, {
      x: 50,
      y: 710,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    const paragraphs = [
      'ForgePDF is a local-first PDF workbench for reading, annotation, page organization, form fill, and signatures.',
      'Highlight this paragraph to test text markup. Underline and strikethrough are also supported.',
      'Chinese UI is available in the app. This sample uses WinAnsi text for Helvetica embedding.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      'Use Organize mode to rotate, delete, reorder, extract, or merge this document with another PDF.',
    ]
    let y = 660
    for (const p of paragraphs) {
      page.drawText(p, {
        x: 50,
        y,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15),
        maxWidth: 500,
        lineHeight: 16,
      })
      y -= 70
    }
  }
  // blank page
  doc.addPage([612, 792])
  return doc.save()
}

async function makeFormPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  page.drawText('ForgePDF — AcroForm Sample', {
    x: 50,
    y: 740,
    size: 18,
    font: bold,
  })
  page.drawText('Please fill the fields below, then sign.', {
    x: 50,
    y: 710,
    size: 12,
    font,
  })

  const form = doc.getForm()

  page.drawText('Full name', { x: 50, y: 650, size: 11, font })
  const name = form.createTextField('full_name')
  name.setText('')
  name.addToPage(page, { x: 50, y: 620, width: 280, height: 24 })

  page.drawText('Email', { x: 50, y: 580, size: 11, font })
  const email = form.createTextField('email')
  email.addToPage(page, { x: 50, y: 550, width: 280, height: 24 })

  page.drawText('Agree to terms', { x: 50, y: 500, size: 11, font })
  const agree = form.createCheckBox('agree_terms')
  agree.addToPage(page, { x: 50, y: 475, width: 18, height: 18 })

  page.drawText('Role', { x: 50, y: 440, size: 11, font })
  const role = form.createDropdown('role')
  role.addOptions(['Engineer', 'Designer', 'PM', 'Other'])
  role.select('Engineer')
  role.addToPage(page, { x: 50, y: 410, width: 200, height: 24 })

  page.drawText('Signature area (place signature in ForgePDF Sign mode)', {
    x: 50,
    y: 340,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  page.drawRectangle({
    x: 50,
    y: 240,
    width: 280,
    height: 80,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
  })

  return doc.save()
}

async function makeMergeB() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  page.drawText('Merge Partner B', {
    x: 180,
    y: 400,
    size: 28,
    font,
    color: rgb(0.18, 0.36, 0.31),
  })
  page.drawText('Append this file when testing Merge.', {
    x: 160,
    y: 360,
    size: 14,
    font,
  })
  page.drawText('WATERMARK TARGET', {
    x: 120,
    y: 280,
    size: 22,
    font,
    color: rgb(0.7, 0.7, 0.7),
    rotate: degrees(-20),
    opacity: 0.5,
  })
  return doc.save()
}

await mkdir(outDir, { recursive: true })
const text = await makeTextPdf()
const form = await makeFormPdf()
const mergeB = await makeMergeB()
await writeFile(join(outDir, 'S-text-multipage.pdf'), text)
await writeFile(join(outDir, 'S-form.pdf'), form)
await writeFile(join(outDir, 'S-merge-b.pdf'), mergeB)
console.log('Wrote samples to', outDir)
console.log('- S-text-multipage.pdf')
console.log('- S-form.pdf')
console.log('- S-merge-b.pdf')
