export type AppMode =
  | 'browse'
  | 'select'
  | 'annotate'
  | 'organize'
  | 'edit'
  | 'form'
  | 'sign'
  | 'redact'
  | 'convert'
  | 'compare'
  | 'security'

export type AnnotTool = 'highlight' | 'underline' | 'strike' | 'note' | 'ink' | 'stamp' | 'area'

export type EditTool =
  | 'select'
  | 'shape'
  | 'text'
  | 'image'
  | 'region'
  | 'replace'
  | 'watermark'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface AnnotationBase {
  id: string
  pageIndex: number
  createdAt: number
  color: string
}

export interface TextMarkupAnnotation extends AnnotationBase {
  kind: 'highlight' | 'underline' | 'strike'
  rects: Rect[]
  /** Quote captured from text selection */
  text?: string
}

export interface NoteAnnotation extends AnnotationBase {
  kind: 'note'
  x: number
  y: number
  content: string
}

export interface InkAnnotation extends AnnotationBase {
  kind: 'ink'
  paths: Point[][]
  width: number
}

export interface StampAnnotation extends AnnotationBase {
  kind: 'stamp'
  x: number
  y: number
  w: number
  h: number
  label: string
}

export type Annotation =
  | TextMarkupAnnotation
  | NoteAnnotation
  | InkAnnotation
  | StampAnnotation

export interface OverlayText {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  w?: number
  h?: number
  bold?: boolean
  locked?: boolean
}

export interface OverlayImage {
  id: string
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
  dataUrl: string
  locked?: boolean
}

/** Visual whiteout / correction fluid (cover edit — not content-stream deletion) */
export interface WhiteoutRect {
  id: string
  pageIndex: number
  rect: Rect
  color: string
  locked?: boolean
}

export interface WatermarkSpec {
  text: string
  opacity: number
  fontSize: number
  rotate: number
  color: string
}

export interface SignaturePlacement {
  id: string
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
  dataUrl: string
}

export interface RedactionRect {
  id: string
  pageIndex: number
  rect: Rect
}

export interface FormFieldValue {
  name: string
  value: string
}

export interface DocMeta {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  producer: string
  creationDate?: string
  modificationDate?: string
}

export interface DocumentModel {
  id: string
  name: string
  bytes: Uint8Array
  dirty: boolean
  pageCount: number
  annotations: Annotation[]
  overlays: OverlayText[]
  images: OverlayImage[]
  whiteouts: WhiteoutRect[]
  signatures: SignaturePlacement[]
  redactions: RedactionRect[]
  watermark?: WatermarkSpec
  formValues: Record<string, string>
  metaEdits?: Partial<DocMeta>
  ocrTextByPage: Record<number, string>
  password?: string
}

export type EditObjectRef =
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string }
  | { kind: 'whiteout'; id: string }

export interface RecentFile {
  name: string
  openedAt: number
}
