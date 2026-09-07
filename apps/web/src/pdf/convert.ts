import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { extractPageImageDataUrl, getPageText } from './engine'

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  saveAs(new Blob([copy.buffer], { type: 'application/pdf' }), filename)
}

export function downloadText(text: string, filename: string) {
  saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}

export async function pdfToImagesZip(
  pdf: PDFDocumentProxy,
  baseName: string,
  scale = 2,
  onProgress?: (page: number, total: number) => void,
) {
  const zip = new JSZip()
  for (let i = 0; i < pdf.numPages; i++) {
    onProgress?.(i + 1, pdf.numPages)
    const url = await extractPageImageDataUrl(pdf, i, scale)
    const base64 = url.split(',')[1]
    zip.file(`${baseName}-p${String(i + 1).padStart(3, '0')}.png`, base64, { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `${baseName}-pages.zip`)
}

export async function pdfToMarkdown(pdf: PDFDocumentProxy, title: string): Promise<string> {
  const parts = [`# ${title}`, '']
  for (let i = 0; i < pdf.numPages; i++) {
    const text = await getPageText(pdf, i)
    parts.push(`## 第 ${i + 1} 页`, '', text || '_（本页无文本层）_', '')
  }
  return parts.join('\n')
}

export async function comparePageCanvases(
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
): Promise<{ diffPercent: number; diffCanvas: HTMLCanvasElement }> {
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  const ca = a.getContext('2d')!
  const cb = b.getContext('2d')!
  const da = ca.getImageData(0, 0, w, h).data
  const db = cb.getImageData(0, 0, w, h).data
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const cox = out.getContext('2d')!
  const img = cox.createImageData(w, h)
  let diff = 0
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const dr = Math.abs(da[o] - db[o])
    const dg = Math.abs(da[o + 1] - db[o + 1])
    const dbv = Math.abs(da[o + 2] - db[o + 2])
    const changed = dr + dg + dbv > 40
    if (changed) {
      diff++
      img.data[o] = 220
      img.data[o + 1] = 40
      img.data[o + 2] = 40
      img.data[o + 3] = 255
    } else {
      img.data[o] = Math.floor((da[o] + db[o]) / 2)
      img.data[o + 1] = Math.floor((da[o + 1] + db[o + 1]) / 2)
      img.data[o + 2] = Math.floor((da[o + 2] + db[o + 2]) / 2)
      img.data[o + 3] = 255
    }
  }
  cox.putImageData(img, 0, 0)
  return { diffPercent: (diff / (w * h)) * 100, diffCanvas: out }
}
