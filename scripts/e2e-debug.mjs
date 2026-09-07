#!/usr/bin/env node
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
page.on('console', (m) => console.log('BROWSER', m.type(), m.text()))
page.on('pageerror', (e) => console.log('PAGEERR', e.message))

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle0' })
console.log('title', await page.title())
console.log('h1', await page.$eval('.welcome-card h1', (el) => el.textContent).catch((e) => e.message))
await page.screenshot({ path: '/tmp/forge-welcome.png', fullPage: true })

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('示例表单'))
  b?.click()
})
await new Promise((r) => setTimeout(r, 2000))
await page.screenshot({ path: '/tmp/forge-form.png', fullPage: true })
console.log('workspace', !!(await page.$('.workspace')))
console.log('pages', await page.$$eval('.page-wrap', (els) => els.length))
console.log('modes', await page.$$eval('.modebar button', (els) => els.map((e) => e.textContent)))

await page.evaluate(() => {
  ;[...document.querySelectorAll('.modebar button')].find((b) => b.textContent?.includes('签名'))?.click()
})
await new Promise((r) => setTimeout(r, 500))
console.log('sign pad', !!(await page.$('.sign-pad')))
await page.evaluate(() => {
  const c = document.querySelector('.sign-pad')
  if (!(c instanceof HTMLCanvasElement)) return 'no canvas'
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = '#15202b'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(20, 50)
  ctx.lineTo(200, 40)
  ctx.stroke()
  return 'drawn'
})
await page.evaluate(() => {
  ;[...document.querySelectorAll('.inspector button')]
    .find((b) => b.textContent?.includes('使用此签名'))
    ?.click()
})
await new Promise((r) => setTimeout(r, 300))
const toast = await page.$eval('.toast', (el) => el.textContent).catch(() => null)
console.log('toast', toast)
const overlay = await page.$('.page-overlay')
const bb = await overlay.boundingBox()
console.log('overlay box', bb)
await page.mouse.click(bb.x + 100, bb.y + 200)
await new Promise((r) => setTimeout(r, 500))
console.log('sig imgs', await page.$$eval('.sig-img', (els) => els.length))
console.log('status', await page.$eval('.statusbar', (el) => el.textContent))
await page.screenshot({ path: '/tmp/forge-sign.png', fullPage: true })
await browser.close()
