import { createContext, useContext, useSyncExternalStore } from 'react'
import type { EditorSnapshot, EditorStore } from '@buildapp/editor'

export const StoreContext = createContext<EditorStore | null>(null)

export function useStore(): EditorStore {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreContext missing')
  return s
}

export function useSnapshot(): EditorSnapshot {
  const store = useStore()
  return useSyncExternalStore(
    (cb) => store.subscribe(() => cb()),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  )
}

// ---------------------------------------------------------------------------
// Render style
// ---------------------------------------------------------------------------

/**
 * How the viewport draws the compiled scene. A property of the viewer, not of
 * the model: it survives a model switch, never enters the undo history and
 * never reaches a saved file, so it lives beside the EditorStore rather than
 * inside it, and is remembered per browser.
 *
 * - `construction` — today's part colours and the model's own materials.
 * - `clay` — one neutral on every opaque surface; glazing still reads.
 * - `architectural` — semantic groups in the shared architectural palette,
 *   with a soft feature-edge line on structural groups.
 */
export type RenderStyleId = 'construction' | 'clay' | 'architectural'

export const RENDER_STYLES: ReadonlyArray<{ id: RenderStyleId; label: string; title: string }> = [
  { id: 'construction', label: 'Construction', title: 'Part colours and the model’s own materials' },
  { id: 'clay', label: 'Clay', title: 'One neutral on every opaque surface; glazing still reads' },
  { id: 'architectural', label: 'Architectural', title: 'Semantic groups in a restrained architectural palette, soft feature edges on structural parts' },
]

export const DEFAULT_RENDER_STYLE: RenderStyleId = 'construction'

const STYLE_STORAGE_KEY = 'buildworld.renderStyle'

const isRenderStyle = (v: unknown): v is RenderStyleId => RENDER_STYLES.some((s) => s.id === v)

function restoreRenderStyle(): RenderStyleId {
  try {
    const stored = globalThis.localStorage?.getItem(STYLE_STORAGE_KEY)
    return isRenderStyle(stored) ? stored : DEFAULT_RENDER_STYLE
  } catch {
    return DEFAULT_RENDER_STYLE
  }
}

function persistRenderStyle(style: RenderStyleId): void {
  try {
    globalThis.localStorage?.setItem(STYLE_STORAGE_KEY, style)
  } catch {
    // A browser that refuses storage still gets the style for this session.
  }
}

class RenderStyleStore {
  private style: RenderStyleId = restoreRenderStyle()
  private readonly listeners = new Set<() => void>()

  get(): RenderStyleId {
    return this.style
  }

  set(style: RenderStyleId): void {
    if (!isRenderStyle(style) || style === this.style) return
    this.style = style
    persistRenderStyle(style)
    for (const l of this.listeners) l()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const renderStyleStore = new RenderStyleStore()

export function useRenderStyle(): RenderStyleId {
  return useSyncExternalStore(
    (cb) => renderStyleStore.subscribe(cb),
    () => renderStyleStore.get(),
    () => renderStyleStore.get(),
  )
}
