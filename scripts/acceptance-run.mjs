import puppeteer from 'puppeteer-core'
import { resolve, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const BASE = process.env.FORGE_URL || 'http://127.0.0.1:5173'
const PDF = resolve(root, 'samples/S-text-multipage.pdf')
const OUT = resolve(root, 'artifacts')
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })
const input = await page.$('input[type=file]')
if (!input) throw new Error('no file input')
await input.uploadFile(PDF)
await page.waitForSelector('canvas.page-canvas', { timeout: 25000 })
await new Promise((r) => setTimeout(r, 2500))

const stats = await page.evaluate(() => {
  const c = document.querySelector('canvas.page-canvas')
  if (!c) return { error: 'no canvas' }
  const ctx = c.getContext('2d')
  const data = ctx.getImageData(0, 0, Math.min(c.width, 900), Math.min(c.height, 1200)).data
  let nonWhite = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) nonWhite++
  }
  return { width: c.width, height: c.height, nonWhite, pages: document.querySelectorAll('canvas.page-canvas').length }
})

await page.screenshot({ path: join(OUT, 'acceptance.png'), fullPage: true })
await browser.close()

console.log(JSON.stringify({ stats, errors: errors.slice(0, 10) }, null, 2))
if (errors.some((e) => /getOrInsertComputed/i.test(e))) {
  console.error('FAIL: pdfjs Map bug')
  process.exit(2)
}
if (stats.error || stats.nonWhite < 800) {
  console.error('FAIL: blank render')
  process.exit(3)
}
console.log('PASS')
