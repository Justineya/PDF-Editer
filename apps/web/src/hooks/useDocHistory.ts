import { useCallback, useRef, useState } from 'react'
import type { DocumentModel } from '../types'

const MAX = 50

/**
 * Document-level undo/redo. Call `commit` after user mutations; `replace` when opening a file.
 */
export function useDocHistory(activeId: string | null) {
  const stacks = useRef(
    new Map<
      string,
      { past: DocumentModel[]; future: DocumentModel[]; present: DocumentModel | null }
    >(),
  )
  const [, bump] = useState(0)

  const ensure = (id: string) => {
    let s = stacks.current.get(id)
    if (!s) {
      s = { past: [], future: [], present: null }
      stacks.current.set(id, s)
    }
    return s
  }

  const clone = (d: DocumentModel): DocumentModel => structuredClone(d)

  const replace = useCallback((doc: DocumentModel) => {
    const s = ensure(doc.id)
    s.past = []
    s.future = []
    s.present = clone(doc)
    bump((n) => n + 1)
  }, [])

  const commit = useCallback((next: DocumentModel) => {
    const s = ensure(next.id)
    if (s.present) {
      s.past.push(s.present)
      if (s.past.length > MAX) s.past.shift()
    }
    s.present = clone(next)
    s.future = []
    bump((n) => n + 1)
  }, [])

  const syncPresent = useCallback((doc: DocumentModel) => {
    ensure(doc.id).present = clone(doc)
  }, [])

  const undo = useCallback((): DocumentModel | null => {
    if (!activeId) return null
    const s = stacks.current.get(activeId)
    if (!s?.present || !s.past.length) return null
    s.future.unshift(s.present)
    s.present = s.past.pop()!
    bump((n) => n + 1)
    return clone(s.present)
  }, [activeId])

  const redo = useCallback((): DocumentModel | null => {
    if (!activeId) return null
    const s = stacks.current.get(activeId)
    if (!s?.present || !s.future.length) return null
    s.past.push(s.present)
    s.present = s.future.shift()!
    bump((n) => n + 1)
    return clone(s.present)
  }, [activeId])

  const canUndo = Boolean(activeId && (stacks.current.get(activeId)?.past.length ?? 0) > 0)
  const canRedo = Boolean(activeId && (stacks.current.get(activeId)?.future.length ?? 0) > 0)

  const drop = useCallback((id: string) => {
    stacks.current.delete(id)
  }, [])

  return { commit, replace, syncPresent, undo, redo, canUndo, canRedo, drop }
}
