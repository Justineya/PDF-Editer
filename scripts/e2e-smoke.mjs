#!/usr/bin/env node
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default

const base = process.env.FORGE_URL || 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message || e)))

await page.goto(base, { waitUntil: 'networkidle0' })
await page.waitForSelector('.welcome-card h1')
const title = await page.$eval('.welcome-card h1', (el) => el.textContent?.trim())
if (title !== 'ForgePDF') throw new Error(`brand missing: ${title}`)

await page.evaluate(() => {
  ;[...document.querySelectorAll('button')]
    .find((x) => x.textContent?.includes('示例表单'))
    ?.click()
})
await page.waitForSelector('.workspace')
await page.waitForSelector('.page-overlay')
await new Promise((r) => setTimeout(r, 600))

// Form fill
await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')]
    .find((b) => b.textContent?.includes('表单'))
    ?.click()
})
await page.waitForSelector('.inspector input[type="text"]')
await page.click('.inspector input[type="text"]', { clickCount: 3 })
await page.type('.inspector input[type="text"]', '验收用户')

// Signature
await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')]
    .find((b) => b.textContent?.includes('签名'))
    ?.click()
})
await page.waitForSelector('canvas.sign-pad')
await page.evaluate(() => {
  const c = document.querySelector('canvas.sign-pad')
  if (!(c instanceof HTMLCanvasElement)) throw new Error('no pad')
  const ctx = c.getContext('2d')
  ctx.strokeStyle = '#15202b'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(20, 50)
  ctx.lineTo(200, 40)
  ctx.stroke()
})
await page.evaluate(() => {
  ;[...document.querySelectorAll('.inspector button')]
    .find((b) => b.textContent?.includes('使用此签名'))
    ?.click()
})
await page.waitForFunction(() =>
  [...document.querySelectorAll('.inspector .muted')].some((el) =>
    el.textContent?.includes('已就绪'),
  ),
)
const info = await page.evaluate(() => {
  const r = document.querySelector('.page-overlay').getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
await page.mouse.click(info.x + info.w * 0.45, info.y + info.h * 0.72)
await page.waitForFunction(() => document.querySelectorAll('.sig-img').length > 0, {
  timeout: 8000,
})

// Open multipage + highlight
const pdfPath = join(root, 'samples/S-text-multipage.pdf')
const inputs = await page.$$('input[type=file]')
await inputs[0].uploadFile(pdfPath)
await page.waitForFunction(() => document.querySelectorAll('.tab').length >= 2)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.tab')]
    .find((x) => x.textContent?.includes('S-text'))
    ?.click()
})
await page.waitForSelector('.page-overlay')
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')]
    .find((b) => b.textContent?.includes('批注'))
    ?.click()
})
await page.evaluate(() => {
  ;[...document.querySelectorAll('.inspector button')]
    .find((b) => b.textContent?.includes('高亮'))
    ?.click()
})
const ob = await page.evaluate(() => {
  const r = document.querySelector('.page-overlay').getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
await page.mouse.move(ob.x + 80, ob.y + 120)
await page.mouse.down()
await page.mouse.move(ob.x + 300, ob.y + 170, { steps: 10 })
await page.mouse.up()
await page.waitForFunction(() => document.querySelectorAll('.markup.highlight').length > 0)

const fatal = errors.filter((e) => !/RenderingCancelled|cancel/i.test(e))
if (fatal.length) {
  console.error(fatal)
  throw new Error('page errors')
}

console.log('UI SMOKE OK')
console.log('- welcome brand')
console.log('- form + signature placed')
console.log('- multipage highlight visible')
await browser.close()
