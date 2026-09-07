#!/usr/bin/env node
/**
 * Generate dense, clearly readable sample PDFs for ForgePDF acceptance.
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'samples')
const require = createRequire(join(root, 'apps/web/package.json'))
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines
}

async function makeTextPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pagesContent = [
    {
      title: 'ForgePDF Demo — Page 1',
      body: [
        'This sample is intentionally dense so you can verify that pages render correctly (not blank).',
        'ForgePDF is a local-first PDF workbench: open files on your machine, annotate, reorganize pages, fill forms, and sign — without uploading to a cloud service.',
        'Try highlight / underline / strikethrough / sticky note / ink / stamp in Annotate mode. Then export and reopen the file to confirm marks were flattened into the page content.',
        'Search for the word RENDER-OK using the search box. If you can find it, text extraction and search are working.',
        'RENDER-OK — if this line is visible, PDF.js rendering succeeded.',
      ],
    },
    {
      title: 'ForgePDF Demo — Page 2',
      body: [
        'Organize mode can merge, extract, delete, rotate, and reorder pages. Open S-merge-b.pdf and merge it into this document as a smoke test.',
        'Light Edit mode places overlay text, images, watermarks, and visual covers. Covers are visual only unless you use the stronger rasterize redaction path.',
        'Zoom with the toolbar. Thumbnails on the left should show readable previews of each page, not empty white rectangles.',
        'Paragraph for scrolling: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        'Another block: Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
      ],
    },
    {
      title: 'ForgePDF Demo — Page 3',
      body: [
        'Form mode works best with S-form.pdf (AcroForm fields). This multi-page text file is for reading, annotation, and organize flows.',
        'Sign mode: draw or import a signature image, then click the page to place it. Export writes the signature into the PDF content stream.',
        'Keyboard shortcuts: Ctrl/Cmd+O open, Ctrl/Cmd+S export, Ctrl/Cmd+F search, Ctrl/Cmd+K command palette.',
        'If pages still look blank after opening, hard-refresh the browser (Ctrl+Shift+R) and confirm /pdf.worker.min.mjs returns HTTP 200.',
        'End of page 3. You should see five pages total including a nearly blank last page used for delete/extract tests.',
      ],
    },
    {
      title: 'ForgePDF Demo — Page 4',
      body: [
        'Checklist for a usable build:',
        '1) Open this PDF and see this checklist text clearly.',
        '2) Thumbnails on the left are not empty.',
        '3) Search finds RENDER-OK from page 1.',
        '4) Add a highlight, export, reopen, highlight still visible.',
        '5) Rotate a page in Organize mode and export.',
        'Quality bar: if any of the above fails, do not hand the build to users.',
      ],
    },
  ]

  for (let i = 0; i < pagesContent.length; i++) {
    const p = pagesContent[i]
    const page = doc.addPage([612, 792])
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) })
    page.drawText(p.title, { x: 48, y: 740, size: 18, font: bold, color: rgb(0.08, 0.12, 0.18) })
    page.drawLine({
      start: { x: 48, y: 728 },
      end: { x: 564, y: 728 },
      thickness: 1,
      color: rgb(0.75, 0.8, 0.78),
    })
    let y = 700
    for (const para of p.body) {
      const lines = wrap(para, font, 12, 510)
      for (const line of lines) {
        if (y < 56) break
        page.drawText(line, { x: 48, y, size: 12, font, color: rgb(0.12, 0.14, 0.16) })
        y -= 18
      }
      y -= 10
    }
    page.drawText(`Page ${i + 1} / 5`, {
      x: 48,
      y: 36,
      size: 10,
      font,
      color: rgb(0.45, 0.5, 0.48),
    })
  }

  const blank = doc.addPage([612, 792])
  blank.drawText('Blank page for organize tests (delete / extract)', {
    x: 48,
    y: 740,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  doc.setTitle('ForgePDF Sample Multi-page')
  doc.setProducer('ForgePDF')
  return doc.save()
}

async function makeFormPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) })
  page.drawText('ForgePDF — AcroForm Sample', { x: 48, y: 740, size: 18, font: bold })
  page.drawText('Fill the fields, switch to Sign mode, place a signature, then Export.', {
    x: 48,
    y: 712,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })

  const form = doc.getForm()
  const fields = [
    ['Full name', 'full_name', 650],
    ['Email', 'email', 580],
    ['Company', 'company', 510],
  ]
  for (const [label, name, y] of fields) {
    page.drawText(label, { x: 48, y, size: 11, font })
    const tf = form.createTextField(name)
    tf.addToPage(page, { x: 48, y: y - 28, width: 320, height: 24 })
  }

  page.drawText('Agree to terms', { x: 48, y: 440, size: 11, font })
  const agree = form.createCheckBox('agree_terms')
  agree.addToPage(page, { x: 48, y: 412, width: 16, height: 16 })

  page.drawText('Role', { x: 48, y: 380, size: 11, font })
  const role = form.createDropdown('role')
  role.addOptions(['Engineer', 'Designer', 'PM', 'Other'])
  role.select('Engineer')
  role.addToPage(page, { x: 48, y: 350, width: 220, height: 24 })

  page.drawText('Signature area — use Sign mode to place a signature here', {
    x: 48,
    y: 300,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  page.drawRectangle({
    x: 48,
    y: 200,
    width: 280,
    height: 80,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 1,
  })

  doc.setTitle('ForgePDF Sample Form')
  doc.setProducer('ForgePDF')
  return doc.save()
}

async function makeMergeB() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.95, 0.97, 0.96) })
  page.drawText('MERGE-B', { x: 200, y: 400, size: 36, font, color: rgb(0.1, 0.45, 0.35) })
  page.drawText('Merge this file into the multi-page sample.', {
    x: 140,
    y: 360,
    size: 14,
    font,
    color: rgb(0.2, 0.25, 0.22),
  })
  return doc.save()
}

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'S-text-multipage.pdf'), await makeTextPdf())
await writeFile(join(outDir, 'S-form.pdf'), await makeFormPdf())
await writeFile(join(outDir, 'S-merge-b.pdf'), await makeMergeB())
console.log('Wrote samples to', outDir)
