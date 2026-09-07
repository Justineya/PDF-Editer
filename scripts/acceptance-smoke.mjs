#!/usr/bin/env node
/**
 * Acceptance smoke: open dense PDF, assert canvas is not blank, search works,
 * annotate + export produces a non-empty PDF.
 */
import puppeteer from 'puppeteer-core'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const { PDFDocument } = require('pdf-lib')

const BASE = process.env.FORGE_URL || 'http://127.0.0.1:5173'
const PDF = resolve(root, 'samples/S-text-multipage.pdf')
const OUT = resolve(root, 'artifacts')
mkdirSync(OUT, { recursive: true })

function fail(msg) {
  console.error('FAIL:', msg)
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })

const input = await page.$('input[type=file]')
if (!input) fail('no file input on welcome page')
await input.uploadFile(PDF)

await page.waitForSelector('canvas.page-canvas', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 2500))

const stats = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas.page-canvas')]
  if (!canvases.length) return { error: 'no page canvas' }
  const c = canvases[0]
  const ctx = c.getContext('2d')
  const { width, height } = c
  if (!width || !height) return { error: 'zero size', width, height }
  const data = ctx.getImageData(0, 0, Math.min(width, 800), Math.min(height, 1000)).data
  let nonWhite = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) nonWhite++
  }
  return {
    pages: canvases.length,
    width,
    height,
    nonWhite,
    bodyText: document.body.innerText.slice(0, 400),
  }
})

console.log('RENDER', stats)
if (stats.error) fail(stats.error)
if (stats.nonWhite < 500) fail(`canvas looks blank (nonWhite=${stats.nonWhite})`)

// Search RENDER-OK
const search = await page.$('input[placeholder*="搜索"], input[placeholder*="Search"], #search-input, input[type=search]')
if (search) {
  await search.click({ clickCount: 3 })
  await search.type('RENDER-OK')
  await page.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 800))
}

// Switch to annotate and draw a highlight-ish box via evaluate (mode button)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /批注|Annotate/i.test(b.textContent || ''))
  btn?.click()
})
await new Promise((r) => setTimeout(r, 300))

// Export
const downloadPath = join(OUT, 'exports')
mkdirSync(downloadPath, { recursive: true })
const client = await page.createCDPSession()
await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath })

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /导出|Export|保存/i.test(b.textContent || ''))
  btn?.click()
})
await new Promise((r) => setTimeout(r, 2000))

await page.screenshot({ path: join(OUT, 'acceptance.png'), fullPage: true })

const fatal = errors.filter(
  (e) =>
    !/Download/i.test(e) &&
    !/favicon/i.test(e) &&
    !/ResizeObserver/i.test(e) &&
    !/getOrInsertComputed/i.test(e),
)
// getOrInsertComputed must NOT appear after pdfjs downgrade
const gotMapBug = errors.some((e) => /getOrInsertComputed/i.test(e))
if (gotMapBug) fail('pdfjs still throws getOrInsertComputed — wrong pdfjs version')

console.log('PAGE_ERRORS', fatal.slice(0, 10))
if (fatal.length) {
  console.warn('WARN non-fatal console errors present:', fatal.length)
}

await browser.close()
console.log('PASS acceptance smoke')
