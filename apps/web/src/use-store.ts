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
