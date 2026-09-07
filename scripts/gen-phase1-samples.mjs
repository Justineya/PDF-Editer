#!/usr/bin/env node
/** Generate Phase-1 samples: bilingual address sheet + image-only 投保书. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const pdfLibPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/web/node_modules/pdf-lib/dist/pdf-lib.esm.js',
)
const { PDFDocument, rgb, StandardFonts } = await import(pdfLibPath)

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'samples/phase1')
const pubDir = join(root, 'apps/web/public/samples/phase1')
mkdirSync(outDir, { recursive: true })
mkdirSync(pubDir, { recursive: true })

const copy = JSON.parse(readFileSync(join(outDir, 'address-copy.json'), 'utf8'))

/** Minimal RGB PNG (no deps) */
function solidPng(w, h, rgbTriple = [245, 245, 240]) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < w; x++) {
      const line = y % 36 === 0 || x === 8 || x === w - 9
      const i = row + 1 + x * 3
      raw[i] = line ? 200 : rgbTriple[0]
      raw[i + 1] = line ? 200 : rgbTriple[1]
      raw[i + 2] = line ? 200 : rgbTriple[2]
    }
  }
  const compressed = deflateSync(raw)
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeB = Buffer.from(type)
    const crc = Buffer.alloc(4)
    const crcVal = crc32(Buffer.concat([typeB, data])) >>> 0
    crc.writeUInt32BE(crcVal)
    return Buffer.concat([len, typeB, data, crc])
  }
  function crc32(buf) {
    let c = ~0
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return ~c
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function makeAddressPdf() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('P1 ADDRESS SAMPLE (replace with user sheet)', {
    x: 48,
    y: 800,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText('ZH (old):', { x: 48, y: 760, size: 11, font })
  page.drawRectangle({
    x: 48,
    y: 720,
    width: 500,
    height: 28,
    color: rgb(0.93, 0.93, 0.93),
    borderWidth: 0,
  })
  page.drawText('[erase+retype target — Chinese address line]', {
    x: 54,
    y: 728,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  page.drawText('PT (old):', { x: 48, y: 680, size: 11, font })
  page.drawRectangle({
    x: 48,
    y: 640,
    width: 500,
    height: 28,
    color: rgb(0.93, 0.93, 0.93),
    borderWidth: 0,
  })
  page.drawText('[erase+retype target — Portuguese address line]', {
    x: 54,
    y: 648,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  page.drawText(`Placeholder ZH: (see address-copy.json)`, {
    x: 48,
    y: 580,
    size: 9,
    font,
  })
  page.drawText(`Placeholder PT: (see address-copy.json)`, {
    x: 48,
    y: 560,
    size: 9,
    font,
  })
  page.drawText('Font accept: overlay with tc-light / tc-demilight vectors (not PNG).', {
    x: 48,
    y: 520,
    size: 9,
    font,
  })
  // Keep Latin placeholders only in content stream; real ZH/PT go via vector overlay in smoke
  void copy
  const bytes = await pdf.save()
  writeFileSync(join(outDir, 'P1-address-cn-pt.pdf'), bytes)
  writeFileSync(join(pubDir, 'P1-address-cn-pt.pdf'), bytes)
  console.log('wrote P1-address-cn-pt.pdf')
}

async function makeInsuranceImageOnly() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const img = await pdf.embedPng(solidPng(600, 848))
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 })
  // no drawText → image-only / no text layer
  const bytes = await pdf.save()
  writeFileSync(join(outDir, 'P1-insurance-image-only.pdf'), bytes)
  writeFileSync(join(pubDir, 'P1-insurance-image-only.pdf'), bytes)
  console.log('wrote P1-insurance-image-only.pdf (image-only)')
}

await makeAddressPdf()
await makeInsuranceImageOnly()
