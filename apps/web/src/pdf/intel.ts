import { createWorker, type LoggerMessage } from 'tesseract.js'

export async function ocrImageDataUrl(
  dataUrl: string,
  lang = 'eng',
  onProgress?: (p: number) => void,
): Promise<string> {
  const worker = await createWorker(lang, 1, {
    logger: (m: LoggerMessage) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress)
      }
    },
  })
  try {
    const { data } = await worker.recognize(dataUrl)
    return data.text.trim()
  } finally {
    await worker.terminate()
  }
}

export function extractiveSummary(text: string, maxSentences = 5): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return '（无可摘要文本。可先 OCR 或打开含文本层的 PDF。）'
  const sentences = cleaned
    .split(/(?<=[。！？.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  if (!sentences.length) return cleaned.slice(0, 400)

  const words = cleaned.toLowerCase().split(/\W+/).filter(Boolean)
  const freq = new Map<string, number>()
  for (const w of words) {
    if (w.length < 3) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }

  const scored = sentences.map((s, i) => {
    const sw = s.toLowerCase().split(/\W+/).filter(Boolean)
    let score = 0
    for (const w of sw) score += freq.get(w) ?? 0
    score = score / Math.sqrt(sw.length || 1)
    score += Math.max(0, 3 - i) * 0.1
    return { s, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
    .slice(0, maxSentences)
    .map((x) => x.s)
    .join('\n\n')
}

export async function answerFromContext(question: string, context: string): Promise<string> {
  const q = question.trim().toLowerCase()
  if (!q) return '请输入问题。'
  if (!context.trim()) return '文档中没有可用文本，请先 OCR。'
  const terms = q.split(/\s+/).filter((t) => t.length > 1)
  const paras = context.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  const ranked = paras
    .map((p) => {
      const low = p.toLowerCase()
      let hit = 0
      for (const t of terms) if (low.includes(t)) hit++
      return { p, hit }
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit)
  if (!ranked.length) {
    return '本地检索未找到直接相关段落。可尝试换关键词，或查看自动摘要。'
  }
  return `基于本地文本检索（非云端模型）：\n\n${ranked
    .slice(0, 3)
    .map((x, i) => `${i + 1}. ${x.p.slice(0, 280)}`)
    .join('\n\n')}`
}
