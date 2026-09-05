import { v4 as uuid } from 'uuid'
import type { DocumentModel, RecentFile } from '../types'
import { destroyPdf, loadPdfDocument } from './engine'
import { createBlankPdf, createSampleFormPdf, readMetadata } from './ops'

const RECENT_KEY = 'forgepdf-recent'

export function loadRecent(): RecentFile[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

export function pushRecent(name: string) {
  const list = loadRecent().filter((r) => r.name !== name)
  list.unshift({ name, openedAt: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)))
}

export async function fileToModel(file: File, password?: string): Promise<DocumentModel> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return bytesToModel(file.name, buf, password)
}

export async function bytesToModel(
  name: string,
  bytes: Uint8Array,
  password?: string,
): Promise<DocumentModel> {
  const id = uuid()
  const pdf = await loadPdfDocument(id, bytes, password)
  pushRecent(name)
  return {
    id,
    name,
    bytes,
    dirty: false,
    pageCount: pdf.numPages,
    annotations: [],
    overlays: [],
    images: [],
    signatures: [],
    redactions: [],
    formValues: {},
    ocrTextByPage: {},
    password,
  }
}

export async function openBlank(): Promise<DocumentModel> {
  const bytes = await createBlankPdf(1)
  return bytesToModel('未命名.pdf', bytes)
}

export async function openSampleForm(): Promise<DocumentModel> {
  const bytes = await createSampleFormPdf()
  return bytesToModel('示例表单.pdf', bytes)
}

export async function reloadBytes(
  model: DocumentModel,
  bytes: Uint8Array,
  markDirty = true,
): Promise<DocumentModel> {
  await destroyPdf(model.id)
  const pdf = await loadPdfDocument(model.id, bytes, model.password)
  return {
    ...model,
    bytes,
    pageCount: pdf.numPages,
    dirty: markDirty,
    annotations: model.annotations.filter((a) => a.pageIndex < pdf.numPages),
    overlays: model.overlays.filter((o) => o.pageIndex < pdf.numPages),
    images: model.images.filter((o) => o.pageIndex < pdf.numPages),
    signatures: model.signatures.filter((o) => o.pageIndex < pdf.numPages),
    redactions: model.redactions.filter((o) => o.pageIndex < pdf.numPages),
  }
}

export async function peekMeta(bytes: Uint8Array) {
  return readMetadata(bytes)
}
