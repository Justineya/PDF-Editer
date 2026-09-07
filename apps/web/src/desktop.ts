/**
 * Thin desktop bridge. In the browser these helpers no-op / return false so
 * the existing <input type="file"> + download path keeps working.
 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export type PickedPdf = { name: string; bytes: Uint8Array; path?: string }

/** Native multi-select open dialog → PDF bytes. */
export async function desktopOpenPdfs(): Promise<PickedPdf[] | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const selected = await open({
    multiple: true,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!selected) return null
  const paths = Array.isArray(selected) ? selected : [selected]
  const out: PickedPdf[] = []
  for (const path of paths) {
    const data = await readFile(path)
    const name = path.split(/[/\\]/).pop() || 'document.pdf'
    out.push({ name, bytes: data, path })
  }
  return out
}

/** Native save dialog → write PDF bytes to disk. Returns chosen path or null. */
export async function desktopSavePdf(
  bytes: Uint8Array,
  defaultName: string,
): Promise<string | null> {
  if (!isTauri()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  const path = await save({
    defaultPath: defaultName.endsWith('.pdf') ? defaultName : `${defaultName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!path) return null
  await writeFile(path, bytes)
  return path
}
