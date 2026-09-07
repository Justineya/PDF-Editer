#!/usr/bin/env node
/** Fortune seed must expand to nearby「810」「6 E」fragments before cover. */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const { expandHitCluster, mergeOverlappingHits } = await import(
  pathToFileURL(join(root, 'apps/web/src/pdf/addressCluster.ts')).href
)
const { layoutTextBlock } = await import(
  pathToFileURL(join(root, 'apps/web/src/pdf/textLayout.ts')).href
)

const items = [
  { str: '澳門南灣湖景大馬路', rect: { x: 100, y: 200, w: 140, h: 10 } },
  { str: '810', rect: { x: 242, y: 200, w: 18, h: 10 } },
  { str: '號中國工商銀行大廈', rect: { x: 262, y: 200, w: 120, h: 10 } },
  { str: '6', rect: { x: 384, y: 200, w: 8, h: 10 } },
  { str: 'E', rect: { x: 394, y: 200, w: 8, h: 10 } },
  { str: '座', rect: { x: 404, y: 200, w: 10, h: 10 } },
  {
    str: 'Edifício Fortune Tower, Macau',
    rect: { x: 100, y: 214, w: 160, h: 10 },
  },
  { str: '電話 Tel: (853) 2830 5686', rect: { x: 100, y: 240, w: 160, h: 10 } },
]

const seed = items[6].rect
const box = expandHitCluster(seed, items)
if (box.x > 100 + 1) {
  console.error('FAIL cluster should reach left Chinese', box)
  process.exit(1)
}
if (box.x + box.w < 404) {
  console.error('FAIL cluster missed 6/E/座 fragments', box)
  process.exit(1)
}
if (box.y > 201) {
  console.error('FAIL cluster should include Chinese line above Fortune', box)
  process.exit(1)
}
if (box.y + box.h > 235) {
  console.error('FAIL cluster swallowed Tel line', box)
  process.exit(1)
}

const hits = mergeOverlappingHits([
  { pageIndex: 0, str: 'Fortune', rect: box },
  { pageIndex: 0, str: '財神', rect: { x: box.x + 10, y: box.y + 2, w: 40, h: 10 } },
])
if (hits.length !== 1) {
  console.error('FAIL merge', hits)
  process.exit(1)
}

const block =
  '澳門南灣湖景大馬路810號中國工商銀行大廈6樓E座\nAvenida Panorâmica do Lago Nam Van, nº 810,\nEdif. ICBC Tower, 6º andar E, Macau'
const natural = layoutTextBlock(block, 8)
const coverH = Math.max(natural.h, box.h) + 10
if (coverH < box.h) {
  console.error('FAIL cover shorter than old cluster', coverH, box)
  process.exit(1)
}

console.log('OK  cluster', box)
console.log('OK  coverH', coverH)
console.log('PASS')
