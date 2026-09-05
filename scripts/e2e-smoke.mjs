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
page.setDefaultTimeout(30000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base, { waitUntil: 'networkidle0' })
await page.waitForSelector('.welcome-card h1')
const title = await page.$eval('.welcome-card h1', (el) => el.textContent)
if (title !== 'ForgePDF') throw new Error(`brand missing: ${title}`)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('示例表单'),
  )
  if (!b) throw new Error('no sample button')
  b.click()
})

await page.waitForSelector('.workspace')
await page.waitForSelector('.page-wrap')

await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')]
    .find((b) => b.textContent?.includes('表单'))
    ?.click()
})
await page.waitForSelector('.inspector input[type="text"]')
await page.click('.inspector input[type="text"]', { clickCount: 3 })
await page.type('.inspector input[type="text"]', '验收用户')

await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')]
    .find((b) => b.textContent?.includes('签名'))
    ?.click()
})
await page.waitForSelector('.sign-pad')
await page.evaluate(() => {
  const c = document.querySelector('.sign-pad')
  if (!(c instanceof HTMLCanvasElement)) return
  const ctx = c.getContext('2d')
  ctx.strokeStyle = '#15202b'
  ctx.lineWidth = 3
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

const overlay = await page.$('.page-overlay')
const bb = await overlay.boundingBox()
await page.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.55)
await page.waitForFunction(() => document.querySelectorAll('.sig-img').length > 0)

const pdfPath = join(root, 'samples/S-text-multipage.pdf')
const inputs = await page.$$('input[type=file]')
await inputs[0].uploadFile(pdfPath)
await page.waitForFunction(() => document.querySelectorAll('.tab').length >= 2)

await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.tab')]
  tabs.find((x) => x.textContent?.includes('S-text'))?.click()
})
await page.waitForSelector('.page-wrap')
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
const ov = await page.$('.page-overlay')
const ob = await ov.boundingBox()
await page.mouse.move(ob.x + 40, ob.y + 80)
await page.mouse.down()
await page.mouse.move(ob.x + 220, ob.y + 110, { steps: 8 })
await page.mouse.up()
await page.waitForFunction(() => document.querySelectorAll('.markup.highlight').length > 0)

if (errors.length) {
  console.error('page errors', errors)
  throw new Error('page errors')
}

console.log('UI SMOKE OK')
console.log('- welcome brand ForgePDF')
console.log('- sample form opened')
console.log('- form typed + signature placed')
console.log('- multipage opened + highlight visible')
await browser.close()
