#!/usr/bin/env node
/**
 * Hands-on edit trials with screenshots for human review.
 * Produces artifacts/edit-trials/index.html + PNGs + report.json
 */
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const require = createRequire(join(root, 'apps/web/package.json'))
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default

const base = process.env.FORGE_URL || 'http://127.0.0.1:5173'
const outDir = join(root, 'artifacts/edit-trials')
mkdirSync(outDir, { recursive: true })

const samples = [
  { id: 'latin', file: join(root, 'samples/E-edit-latin.pdf'), title: 'Latin stream/text/shape' },
  { id: 'cjk', file: join(root, 'samples/E-edit-cjk-ui.pdf'), title: 'CJK UI font + ellipse' },
  { id: 'mixed', file: join(root, 'samples/E-edit-mixed.pdf'), title: 'Mixed stress select/delete' },
]

const report = { startedAt: new Date().toISOString(), cases: [], bugs: [], shots: [] }
const pass = (c, msg) => {
  c.ok.push(msg)
  console.log('  OK ', msg)
}
const fail = (c, msg) => {
  c.fail.push(msg)
  report.bugs.push(`${c.id}: ${msg}`)
  console.error('  FAIL', msg)
}

const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable'].find((p) => {
  try {
    require('node:fs').accessSync(p)
    return true
  } catch {
    return false
  }
})

async function shot(page, name) {
  const path = join(outDir, `${name}.png`)
  await page.screenshot({ path, fullPage: false })
  report.shots.push(path)
  return path
}

async function enterEdit(page) {
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
  await new Promise((r) => setTimeout(r, 400))
}

async function setZoom(page, pctLabel) {
  // Use + / − buttons to approximate; or set via evaluate if App exposes nothing.
  // Click zoom until near target by reading muted percent.
  for (let i = 0; i < 20; i++) {
    const cur = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.modebar .muted, .modebar span.muted')].find((e) =>
        /%$/.test(e.textContent || ''),
      )
      return el?.textContent?.trim() || ''
    })
    const n = parseInt(cur, 10)
    if (!n) break
    if (Math.abs(n - pctLabel) <= 8) return cur
    if (n < pctLabel) {
      await page.evaluate(() => {
        ;[...document.querySelectorAll('.modebar button')].find((b) => b.textContent?.trim() === '+')?.click()
      })
    } else {
      await page.evaluate(() => {
        ;[...document.querySelectorAll('.modebar button')].find((b) => b.textContent?.trim() === '−' || b.textContent?.trim() === '-')?.click()
      })
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return await page.evaluate(() => {
    const el = [...document.querySelectorAll('.modebar .muted, .modebar span.muted')].find((e) =>
      /%$/.test(e.textContent || ''),
    )
    return el?.textContent?.trim() || '?'
  })
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas.page-canvas')
    if (!(c instanceof HTMLCanvasElement)) return { error: 'no canvas' }
    const ctx = c.getContext('2d')
    const { width, height } = c
    const cssW = parseFloat(c.style.width) || c.clientWidth
    const cssH = parseFloat(c.style.height) || c.clientHeight
    const sample = ctx.getImageData(0, 0, Math.min(width, 400), Math.min(height, 200)).data
    let edge = 0
    for (let y = 1; y < Math.min(height, 200); y++) {
      for (let x = 1; x < Math.min(width, 400); x++) {
        const i = (y * Math.min(width, 400) + x) * 4
        const j = (y * Math.min(width, 400) + x - 1) * 4
        const d = Math.abs(sample[i] - sample[j]) + Math.abs(sample[i + 1] - sample[j + 1])
        if (d > 40) edge++
      }
    }
    return {
      bitmap: `${width}x${height}`,
      css: `${Math.round(cssW)}x${Math.round(cssH)}`,
      dprApprox: cssW ? +(width / cssW).toFixed(2) : null,
      edgeDensity: edge,
    }
  })
}

async function pageBox(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.page-overlay, canvas.page-canvas')
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

async function clickTool(page, labelPart) {
  await page.evaluate((label) => {
    ;[...document.querySelectorAll('.edit-toolbar button')]
      .find((b) => (b.textContent || '').includes(label))
      ?.click()
  }, labelPart)
  await new Promise((r) => setTimeout(r, 200))
}

async function setStyle(page, { font, size, fill, textColor, shape }) {
  await page.evaluate(
    ({ font, size, fill, textColor, shape }) => {
      const bar = document.querySelector('.edit-stylebar')
      if (!bar) return
      const sel = bar.querySelector('select')
      if (sel && font) {
        const opt = [...sel.options].find((o) => (o.textContent || '').includes(font) || o.value === font)
        if (opt) {
          sel.value = opt.value
          sel.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      const num = bar.querySelector('input[type=number]')
      if (num && size) {
        num.value = String(size)
        num.dispatchEvent(new Event('input', { bubbles: true }))
        num.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const colors = [...bar.querySelectorAll('input[type=color]')]
      if (colors[0] && textColor) {
        colors[0].value = textColor
        colors[0].dispatchEvent(new Event('input', { bubbles: true }))
        colors[0].dispatchEvent(new Event('change', { bubbles: true }))
      }
      if (colors[1] && fill) {
        colors[1].value = fill
        colors[1].dispatchEvent(new Event('input', { bubbles: true }))
        colors[1].dispatchEvent(new Event('change', { bubbles: true }))
      }
      if (shape) {
        ;[...bar.querySelectorAll('.edit-style-shapes button')]
          .find((b) => (b.textContent || '').includes(shape))
          ?.click()
      }
    },
    { font, size, fill, textColor, shape },
  )
  await new Promise((r) => setTimeout(r, 150))
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 960, deviceScaleFactor: 2 },
})

try {
  // Generate samples if missing
  for (const s of samples) {
    if (!existsSync(s.file)) {
      console.log('missing sample, run gen-edit-samples first:', s.file)
    }
  }

  for (const sample of samples) {
    if (!existsSync(sample.file)) {
      report.bugs.push(`${sample.id}: sample file missing`)
      continue
    }
    console.log('\n===', sample.id, '===')
    const c = { id: sample.id, title: sample.title, ok: [], fail: [], notes: [] }
    const page = await browser.newPage()
    page.setDefaultTimeout(25000)
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))

    try {
      await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 })
      const input = await page.$('input[type=file]')
      await input.uploadFile(sample.file)
      await page.waitForSelector('canvas.page-canvas', { timeout: 20000 })
      await new Promise((r) => setTimeout(r, 1200))

      const zoom = await setZoom(page, 150)
      c.notes.push(`zoom=${zoom}`)
      await new Promise((r) => setTimeout(r, 600))
      const stats = await canvasStats(page)
      c.notes.push(`canvas=${JSON.stringify(stats)}`)
      if (stats.dprApprox && stats.dprApprox >= 1.8) pass(c, `HiDPI render ~${stats.dprApprox}x`)
      else fail(c, `low DPR render: ${stats.dprApprox}`)
      if (stats.edgeDensity > 200) pass(c, `text edges present (${stats.edgeDensity})`)
      else fail(c, `canvas looks soft/blank edges=${stats.edgeDensity}`)
      await shot(page, `${sample.id}-01-baseline`)

      await enterEdit(page)
      const styleOk = await page.evaluate(() => !!document.querySelector('.edit-stylebar select'))
      if (styleOk) pass(c, 'style bar visible')
      else fail(c, 'style bar missing')

      // Shape create + select + delete
      await setStyle(page, {
        fill: '#2f5d50',
        shape: sample.id === 'cjk' ? '椭圆' : '矩形',
        font: sample.id === 'cjk' ? '黑体' : 'Helvetica',
        size: 18,
        textColor: '#15202b',
      })
      await clickTool(page, '图形')
      const box = await pageBox(page)
      const sx = box.x + box.w * 0.12
      const sy = box.y + box.h * 0.28
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      await page.mouse.move(sx + 180, sy + 90, { steps: 10 })
      await page.mouse.up()
      await new Promise((r) => setTimeout(r, 450))
      let shapes = await page.evaluate(
        () => document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout').length,
      )
      if (shapes >= 1) pass(c, `shape created (${shapes})`)
      else fail(c, 'shape not created')
      const selected = await page.evaluate(() => !!document.querySelector('.edit-obj.selected'))
      if (selected) pass(c, 'shape auto-selected')
      else fail(c, 'shape not auto-selected')
      await shot(page, `${sample.id}-02-shape`)

      // Delete via chrome
      const del = await page.$('.edit-obj-chrome-btn.danger')
      if (del) {
        await del.click()
        await new Promise((r) => setTimeout(r, 300))
      } else {
        await page.keyboard.press('Delete')
        await new Promise((r) => setTimeout(r, 300))
      }
      shapes = await page.evaluate(
        () => document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout').length,
      )
      if (shapes === 0) pass(c, 'shape deleted')
      else fail(c, `shape still present (${shapes})`)

      // Text place
      await setStyle(page, {
        font: sample.id === 'cjk' ? '黑体' : 'Times',
        size: 20,
        textColor: '#b42318',
      })
      await clickTool(page, '文字')
      await page.mouse.click(box.x + box.w * 0.2, box.y + box.h * 0.55)
      await new Promise((r) => setTimeout(r, 350))
      const hasEditor = await page.$('.inline-text-editor textarea')
      if (hasEditor) {
        await hasEditor.click({ clickCount: 3 })
        await page.keyboard.type(sample.id === 'cjk' ? '中文试改' : 'TRIAL-TEXT')
        await page.evaluate(() => {
          ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('完成'))?.click()
        })
        await new Promise((r) => setTimeout(r, 450))
      } else fail(c, 'inline text editor missing')

      const texts = await page.evaluate(() =>
        [...document.querySelectorAll('.edit-obj.text .edit-obj-label, .edit-obj.text')].map((el) => (el.querySelector('.edit-obj-label')||el).textContent?.replace(/\s+/g, ' ').trim()),
      )
      if (texts.some((t) => /TRIAL-TEXT|中文试改/.test(t || ''))) pass(c, `text placed: ${texts[0]?.slice(0, 40)}`)
      else fail(c, `text missing after place: ${JSON.stringify(texts)}`)

      // Must return to select and keep single object selectable
      const active = await page.evaluate(
        () =>
          document.querySelector('.edit-toolbar button.active, .edit-toolbar button[aria-pressed="true"]')
            ?.textContent?.trim() || '',
      )
      if (active.includes('选择')) pass(c, 'returned to select after text')
      else fail(c, `stuck on tool ${active}`)

      await page.evaluate(() => {
        const el = document.querySelector('.edit-obj.text')
        el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      })
      await new Promise((r) => setTimeout(r, 200))
      if (await page.evaluate(() => !!document.querySelector('.edit-obj.text.selected'))) {
        pass(c, 'text re-selectable')
      } else fail(c, 'text not re-selectable')
      await shot(page, `${sample.id}-03-text`)

      // Whiteout regression: ensure no accidental whiteouts from text place
      const whiteCount = await page.evaluate(
        () => document.querySelectorAll('.edit-obj.shape, .edit-obj.whiteout').length,
      )
      if (whiteCount === 0) pass(c, 'no auto white block after text')
      else fail(c, `unexpected shapes/whiteouts after text: ${whiteCount}`)

      // Stream/region edit on latin only
      if (sample.id === 'latin') {
        await clickTool(page, '框选')
        await page.mouse.move(box.x + box.w * 0.08, box.y + box.h * 0.12)
        await page.mouse.down()
        await page.mouse.move(box.x + box.w * 0.7, box.y + box.h * 0.2, { steps: 8 })
        await page.mouse.up()
        await new Promise((r) => setTimeout(r, 400))
        const menu = await page.evaluate(() =>
          [...document.querySelectorAll('.region-action-menu button')].map((b) => b.textContent?.trim()),
        )
        c.notes.push(`regionMenu=${menu.join('|')}`)
        if (menu.some((m) => m?.includes('修改原文'))) {
          await page.evaluate(() => {
            ;[...document.querySelectorAll('.region-action-menu button')]
              .find((b) => (b.textContent || '').includes('修改原文'))
              ?.click()
          })
          await new Promise((r) => setTimeout(r, 300))
          const ta = await page.$('.inline-text-editor textarea')
          if (ta) {
            await ta.click({ clickCount: 3 })
            await page.keyboard.type('STREAM-EDIT-OK')
            await page.evaluate(() => {
              ;[...document.querySelectorAll('button')]
                .find((b) => (b.textContent || '').includes('完成'))
                ?.click()
            })
            await new Promise((r) => setTimeout(r, 1200))
            await shot(page, `${sample.id}-04-stream`)
            pass(c, 'stream-edit path exercised')
          } else fail(c, 'stream inline editor missing')
        } else fail(c, 'region menu missing 修改原文')
      }

      if (pageErrors.length) fail(c, `page errors: ${pageErrors[0]}`)
      else pass(c, 'no page errors')
    } catch (e) {
      fail(c, String(e?.message || e))
      try {
        await shot(page, `${sample.id}-error`)
      } catch {
        /* ignore */
      }
    } finally {
      report.cases.push(c)
      await page.close()
    }
  }
} finally {
  await browser.close()
}

// Gallery HTML for human review
const cards = report.cases
  .map((c) => {
    const shots = report.shots
      .filter((s) => s.includes(`/${c.id}-`) || s.endsWith(`\\${c.id}-`))
      .map((s) => s.split(/[/\\]/).pop())
    return `<section class="case">
      <h2>${c.id} — ${c.title}</h2>
      <p class="notes">${(c.notes || []).join(' · ')}</p>
      <ul class="ok">${c.ok.map((x) => `<li>OK ${x}</li>`).join('')}</ul>
      <ul class="fail">${c.fail.map((x) => `<li>FAIL ${x}</li>`).join('')}</ul>
      <div class="shots">${shots.map((f) => `<figure><img src="${f}" alt="${f}"/><figcaption>${f}</figcaption></figure>`).join('')}</div>
    </section>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<title>ForgePDF edit trials</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f4f6f5;color:#15202b}
h1{margin:0 0 8px} .meta{color:#667;margin-bottom:24px}
.case{background:#fff;border:1px solid #d7ddd9;border-radius:10px;padding:16px;margin-bottom:20px}
.ok li{color:#1b6b3a}.fail li{color:#b42318}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px}
figure{margin:0} img{width:100%;border:1px solid #ccd;border-radius:6px;background:#fff}
figcaption{font-size:12px;color:#667;margin-top:4px}
.bugs{background:#fff4f2;border:1px solid #f0c2ba;padding:12px;border-radius:8px}
</style></head><body>
<h1>ForgePDF 编辑试用报告</h1>
<p class="meta">${report.startedAt} · cases=${report.cases.length} · bugs=${report.bugs.length}</p>
${report.bugs.length ? `<div class="bugs"><strong>Bugs</strong><ul>${report.bugs.map((b) => `<li>${b}</li>`).join('')}</ul></div>` : '<p>未发现脚本断言失败。</p>'}
${cards}
</body></html>`

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(join(outDir, 'index.html'), html)
console.log('\nWrote', join(outDir, 'index.html'))
console.log('BUGS', report.bugs.length)
if (report.bugs.length) process.exit(1)
