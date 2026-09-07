#!/usr/bin/env node
/**
 * Fetch Adobe Source Han Sans TC Light + Normal(DemiLight) into assets/fonts/tc.
 * Prefer replacing with files from the user's 字体/ folder when available.
 */
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'assets/fonts/tc')
const cacheDir = join(outDir, '.cache')

const FILES = [
  {
    url: 'https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/OTF/TraditionalChinese/SourceHanSansTC-Light.otf',
    cacheAs: 'SourceHanSansTC-Light.otf',
    publishAs: 'SourceHanSansTC-Light.otf',
  },
  {
    // Adobe names DemiLight weight as Normal
    url: 'https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/OTF/TraditionalChinese/SourceHanSansTC-Normal.otf',
    cacheAs: 'SourceHanSansTC-Normal.otf',
    publishAs: 'SourceHanSansTC-DemiLight.otf',
  },
]

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

mkdirSync(cacheDir, { recursive: true })
for (const f of FILES) {
  const cachePath = join(cacheDir, f.cacheAs)
  if (!existsSync(cachePath) || readFileSync(cachePath).byteLength < 1000) {
    console.log('download', f.cacheAs)
    await download(f.url, cachePath)
  } else {
    console.log('cache hit', f.cacheAs)
  }
  copyFileSync(cachePath, join(outDir, f.publishAs))
  // also mirror for web public
  const pub = join(root, 'apps/web/public/fonts/tc')
  mkdirSync(pub, { recursive: true })
  copyFileSync(cachePath, join(pub, f.publishAs))
}

writeFileSync(
  join(outDir, 'MANIFEST.json'),
  JSON.stringify(
    {
      note: 'DemiLight = Adobe SourceHanSansTC-Normal.otf. Replace with 字体/ copies when available.',
      files: FILES.map((f) => f.publishAs),
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
)
console.log('OK →', outDir)
