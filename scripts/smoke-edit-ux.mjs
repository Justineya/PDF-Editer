#!/usr/bin/env node
/**
 * Smoke: edit UX — select objects, shape+color create, delete, no endless add.
 */
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default

const base = process.env.FORGE_URL || 'http://127.0.0.1:5173'
const pdfPath = join(root, 'samples/S-text-multipage.pdf')
const outDir = join(root, 'artifacts')
mkdirSync(outDir, { recursive: true })

const report = { ok: [], fail: [] }
const pass = (m) => {
  report.ok.push(m)
  console.log('OK ', m)
}
const fail = (m) => {
  report.fail.push(m)
  console.error('FAIL', m)
}

const chrome =
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(
    (p) => {
      try {
        require('node:fs').accessSync(p)
        return true
      } catch {
        return false
      }
    },
  )

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 960 })
page.setDefaultTimeout(25000)

try {
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 })
  const input = await page.$('input[type=file]')
  await input.uploadFile(pdfPath)
  await page.waitForSelector('canvas.page-canvas', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1000))
  pass('opened PDF')

  await page.evaluate(() => {
    ;[...document.querySelectorAll('.modebar button')]
      .find((b) => (b.textContent || '').includes('编辑'))
      ?.click()
  })
  await page.waitForFunction(
    () => (document.querySelector('.modebar button.active')?.textContent || '').includes('编辑'),
    { timeout: 8000 },
  )
  await page.waitForSelector('.edit-toolbar', { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 300))

  const tools = await page.evaluate(() => {
    const bar = document.querySelector('.edit-toolbar')
    const labels = [...bar.querySelectorAll('button')].map((b) => b.textContent?.trim())
    const active = bar.querySelector('button.active, button[aria-pressed="true"]')?.textContent?.trim()
    const color = bar.querySelector('input[type=color]')
    return { labels, active, hasColor: !!color }
  })
  console.log('TOOLS', tools)
  if (tools.active?.includes('选择')) pass('default tool is 选择')
  else fail(`expected default 选择, got ${tools.active}`)
  if (tools.labels.some((l) => l?.includes('图形') || l?.includes('图形'))) pass('shape tool present')
  else fail('shape tool missing')
  // color pickers live in style bar now
  pass('color pickers checked via style bar')
    const style = await page.evaluate(() => ({
    stylebar: !!document.querySelector('.edit-stylebar'),
    fonts: [...document.querySelectorAll('.edit-stylebar select option')].map((o) => o.textContent?.trim()),
    shapes: [...document.querySelectorAll('.edit-style-shapes button')].map((b) => b.textContent?.trim()),
    colors: document.querySelectorAll('.edit-stylebar input[type=color]').length,
  }))
  console.log('STYLE', style)
  if (style.stylebar) pass('style bar present (pick before place)')
  else fail('style bar missing')
  if (style.fonts?.length >= 3) pass(`fonts available: ${style.fonts.join('/')}`)
  else fail('font options missing')
  if (style.shapes?.some((s) => s?.includes('矩形') || s?.includes('图形')) && style.shapes?.some((s) => s?.includes('椭圆'))) pass('rect/ellipse shape pickers')
  else fail('shape pickers missing')
  if (style.colors >= 2) pass('text + fill color pickers')
  else fail('color pickers missing')

if (!tools.labels.some((l) => l?.includes('白盖') || l?.includes('覆盖'))) {
    pass('cover/whiteout removed from primary tools')
  } else fail('cover/whiteout still in primary tools')

  // Draw a shape
  await page.evaluate(() => {
    ;[...document.querySelectorAll('.edit-toolbar button')]
      .find((b) => (b.textContent || '').includes('图形'))
      ?.click()
  })
  await page.evaluate(() => {
    const c = document.querySelector('.edit-toolbar input[type=color]')
    if (c) {
      c.value = '#e4572e'
      c.dispatchEvent(new Event('input', { bubbles: true }))
      c.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 200))

  const pageBox = await page.evaluate(() => {
    const el = document.querySelector('.page-overlay, canvas.page-canvas')
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  await page.mouse.move(pageBox.x + pageBox.w * 0.2, pageBox.y + pageBox.h * 0.2)
  await page.mouse.down()
  await page.mouse.move(pageBox.x + pageBox.w * 0.45, pageBox.y + pageBox.h * 0.35, { steps: 8 })
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 400))

  const afterShape = await page.evaluate(() => {
    const shapes = document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout')
    const selected = document.querySelector('.edit-obj.selected')
    const chrome = document.querySelector('.edit-obj-chrome')
    const active = document.querySelector('.edit-toolbar button.active, .edit-toolbar button[aria-pressed="true"]')
      ?.textContent?.trim()
    return {
      shapeCount: shapes.length,
      hasSelected: !!selected,
      hasChrome: !!chrome,
      activeTool: active,
    }
  })
  console.log('AFTER_SHAPE', afterShape)
  if (afterShape.shapeCount >= 1) pass(`shape created (${afterShape.shapeCount})`)
  else fail('shape not created')
  if (afterShape.hasSelected) pass('new shape auto-selected')
  else fail('shape not auto-selected')
  if (afterShape.hasChrome) pass('delete chrome visible on selection')
  else fail('selection chrome missing')
  if (afterShape.activeTool?.includes('选择')) pass('auto-switched back to 选择')
  else fail(`did not return to 选择, got ${afterShape.activeTool}`)

  // Click delete chrome (Puppeteer click for reliable React handlers)
  const delBtn = await page.$('.edit-obj-chrome-btn.danger')
  if (!delBtn) fail('delete chrome button missing')
  else {
    await delBtn.click()
    await new Promise((r) => setTimeout(r, 300))
    const remaining = await page.evaluate(
      () => document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout').length,
    )
    console.log('DELETE', { remaining })
    if (remaining === 0) pass('delete via chrome works')
    else fail(`delete chrome left ${remaining} shapes`)
  }

  // Create again, then Delete key
  await page.evaluate(() => {
    ;[...document.querySelectorAll('.edit-toolbar button')]
      .find((b) => (b.textContent || '').includes('图形'))
      ?.click()
  })
  await new Promise((r) => setTimeout(r, 150))
  await page.mouse.move(pageBox.x + pageBox.w * 0.25, pageBox.y + pageBox.h * 0.25)
  await page.mouse.down()
  await page.mouse.move(pageBox.x + pageBox.w * 0.4, pageBox.y + pageBox.h * 0.4, { steps: 6 })
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 350))
  await page.keyboard.press('Delete')
  await new Promise((r) => setTimeout(r, 200))
  const afterKey = await page.evaluate(
    () => document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout').length,
  )
  if (afterKey === 0) pass('Delete key removes selected shape')
  else fail(`Delete key left ${afterKey} shapes`)

  // Text tool should not keep adding unboundedly without select return
  await page.evaluate(() => {
    ;[...document.querySelectorAll('.edit-toolbar button')]
      .find((b) => (b.textContent || '').trim().includes('文字'))
      ?.click()
  })
  await new Promise((r) => setTimeout(r, 150))
  await page.mouse.click(pageBox.x + pageBox.w * 0.3, pageBox.y + pageBox.h * 0.5)
  await new Promise((r) => setTimeout(r, 300))
  const editor = await page.$('.inline-text-editor textarea, .edit-obj-editor, textarea')
  if (editor) {
    await editor.click({ clickCount: 3 })
    await page.keyboard.type('OBJ1')
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button')]
        .find((b) => /完成|确认/.test(b.textContent || ''))
        ?.click()
    })
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    await new Promise((r) => setTimeout(r, 400))
  }
  const textState = await page.evaluate(() => {
    const texts = [...document.querySelectorAll('.edit-obj.text')]
    const selected = document.querySelector('.edit-obj.text.selected')
    const active = document.querySelector('.edit-toolbar button.active, .edit-toolbar button[aria-pressed="true"]')
      ?.textContent?.trim()
    return {
      count: texts.length,
      selectedText: selected?.textContent?.replace(/\s+/g, ' ').trim(),
      active,
    }
  })
  console.log('TEXT', textState)
  if (textState.count >= 1) pass('text object created')
  else fail('text object missing')
  if (textState.active?.includes('选择')) pass('returned to select after text')
  else fail(`after text still on ${textState.active}`)

  // Click select then click object
  await page.evaluate(() => {
    const el = document.querySelector('.edit-obj.text')
    if (!el) return
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  })
  await new Promise((r) => setTimeout(r, 200))
  const reselected = await page.evaluate(() => !!document.querySelector('.edit-obj.text.selected'))
  if (reselected) pass('click re-selects text object')
  else fail('could not re-select text object')

  await page.screenshot({ path: join(outDir, 'smoke-edit-ux.png'), fullPage: false })
} catch (e) {
  fail(String(e?.message || e))
  try {
    await page.screenshot({ path: join(outDir, 'smoke-edit-ux-error.png'), fullPage: true })
  } catch {
    /* ignore */
  }
} finally {
  writeFileSync(join(outDir, 'smoke-edit-ux-report.json'), JSON.stringify(report, null, 2))
  await browser.close()
}

console.log(`\n=== SUMMARY pass=${report.ok.length} fail=${report.fail.length} ===`)
if (report.fail.length) process.exit(1)
