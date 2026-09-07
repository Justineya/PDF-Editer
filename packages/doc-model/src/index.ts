/** Portable document session + undo for Phase-1 overlay editing. */

export type Rect = { x: number; y: number; w: number; h: number }

export type OverlayText = {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  /** tc-light | tc-demilight | helvetica | … */
  fontFamily: string
  w?: number
  h?: number
  locked?: boolean
}

export type OverlayImage = {
  id: string
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
  dataUrl: string
  locked?: boolean
}

/** Erase / whiteout region before retype */
export type OverlayErase = {
  id: string
  pageIndex: number
  rect: Rect
  color: string
  locked?: boolean
}

export type DocumentSnapshot = {
  name: string
  path?: string
  bytes: Uint8Array
  pageCount: number
  dirty: boolean
  /** True when page has no extractable text layer (投保书图档) */
  imageOnlyPages: Record<number, boolean>
  texts: OverlayText[]
  images: OverlayImage[]
  erases: OverlayErase[]
}

export type DocPatch =
  | { op: 'set-meta'; name?: string; path?: string; dirty?: boolean }
  | { op: 'replace-bytes'; bytes: Uint8Array; pageCount: number }
  | { op: 'set-image-only'; pageIndex: number; value: boolean }
  | { op: 'upsert-text'; item: OverlayText }
  | { op: 'upsert-image'; item: OverlayImage }
  | { op: 'upsert-erase'; item: OverlayErase }
  | { op: 'remove'; kind: 'text' | 'image' | 'erase'; id: string }
  | { op: 'replace-all'; snap: Omit<DocumentSnapshot, 'bytes'> & { bytes?: Uint8Array } }

function cloneBytes(b: Uint8Array) {
  return Uint8Array.from(b)
}

function applyPatch(state: DocumentSnapshot, patch: DocPatch): DocumentSnapshot {
  switch (patch.op) {
    case 'set-meta':
      return {
        ...state,
        name: patch.name ?? state.name,
        path: patch.path ?? state.path,
        dirty: patch.dirty ?? state.dirty,
      }
    case 'replace-bytes':
      return {
        ...state,
        bytes: cloneBytes(patch.bytes),
        pageCount: patch.pageCount,
        dirty: false,
      }
    case 'set-image-only':
      return {
        ...state,
        imageOnlyPages: { ...state.imageOnlyPages, [patch.pageIndex]: patch.value },
      }
    case 'upsert-text':
      return {
        ...state,
        dirty: true,
        texts: [...state.texts.filter((t) => t.id !== patch.item.id), patch.item],
      }
    case 'upsert-image':
      return {
        ...state,
        dirty: true,
        images: [...state.images.filter((t) => t.id !== patch.item.id), patch.item],
      }
    case 'upsert-erase':
      return {
        ...state,
        dirty: true,
        erases: [...state.erases.filter((t) => t.id !== patch.item.id), patch.item],
      }
    case 'remove': {
      const key = patch.kind === 'text' ? 'texts' : patch.kind === 'image' ? 'images' : 'erases'
      return {
        ...state,
        dirty: true,
        [key]: (state[key] as { id: string }[]).filter((x) => x.id !== patch.id),
      }
    }
    case 'replace-all':
      return {
        name: patch.snap.name,
        path: patch.snap.path,
        bytes: patch.snap.bytes ? cloneBytes(patch.snap.bytes) : state.bytes,
        pageCount: patch.snap.pageCount,
        dirty: patch.snap.dirty,
        imageOnlyPages: { ...patch.snap.imageOnlyPages },
        texts: [...patch.snap.texts],
        images: [...patch.snap.images],
        erases: [...patch.snap.erases],
      }
    default:
      return state
  }
}

export class UndoStack {
  private undo: DocPatch[][] = []
  private redo: DocPatch[][] = []
  private limit: number
  constructor(limit = 80) {
    this.limit = limit
  }

  push(transaction: DocPatch[]) {
    if (!transaction.length) return
    this.undo.push(transaction)
    if (this.undo.length > this.limit) this.undo.shift()
    this.redo = []
  }

  canUndo() {
    return this.undo.length > 0
  }
  canRedo() {
    return this.redo.length > 0
  }

  /** Caller supplies inverse patches when undoing. */
  popUndo(): DocPatch[] | null {
    const t = this.undo.pop()
    if (!t) return null
    this.redo.push(t)
    return t
  }

  popRedo(): DocPatch[] | null {
    const t = this.redo.pop()
    if (!t) return null
    this.undo.push(t)
    return t
  }

  clear() {
    this.undo = []
    this.redo = []
  }
}

export class DocumentSession {
  private state: DocumentSnapshot
  readonly undo = new UndoStack()
  /** Inverse of last applied transactions, parallel to undo stack depth — simplified: store full snapshots */
  private history: DocumentSnapshot[] = []
  private future: DocumentSnapshot[] = []

  constructor(init: DocumentSnapshot) {
    this.state = {
      ...init,
      bytes: cloneBytes(init.bytes),
      texts: [...init.texts],
      images: [...init.images],
      erases: [...init.erases],
      imageOnlyPages: { ...init.imageOnlyPages },
    }
  }

  get snapshot(): DocumentSnapshot {
    return this.state
  }

  private cloneState(): DocumentSnapshot {
    return {
      ...this.state,
      bytes: cloneBytes(this.state.bytes),
      texts: this.state.texts.map((t) => ({ ...t })),
      images: this.state.images.map((t) => ({ ...t })),
      erases: this.state.erases.map((t) => ({ ...t, rect: { ...t.rect } })),
      imageOnlyPages: { ...this.state.imageOnlyPages },
    }
  }

  /** Apply patches as one undoable transaction. */
  commit(patches: DocPatch[]) {
    if (!patches.length) return
    this.history.push(this.cloneState())
    if (this.history.length > 80) this.history.shift()
    this.future = []
    this.undo.push(patches)
    for (const p of patches) this.state = applyPatch(this.state, p)
  }

  undoOnce(): boolean {
    if (!this.history.length) return false
    this.future.push(this.cloneState())
    this.state = this.history.pop()!
    this.undo.popUndo()
    return true
  }

  redoOnce(): boolean {
    if (!this.future.length) return false
    this.history.push(this.cloneState())
    this.state = this.future.pop()!
    this.undo.popRedo()
    return true
  }

  markImageOnly(pageIndex: number, value: boolean) {
    this.commit([{ op: 'set-image-only', pageIndex, value }])
  }

  addEraseRetype(erase: OverlayErase, text: OverlayText) {
    this.commit([
      { op: 'upsert-erase', item: erase },
      { op: 'upsert-text', item: text },
    ])
  }
}

export function createEmptySession(
  name: string,
  bytes: Uint8Array,
  pageCount: number,
  path?: string,
): DocumentSession {
  return new DocumentSession({
    name,
    path,
    bytes: cloneBytes(bytes),
    pageCount,
    dirty: false,
    imageOnlyPages: {},
    texts: [],
    images: [],
    erases: [],
  })
}
