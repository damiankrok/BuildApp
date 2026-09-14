import type { JSX } from 'react'
import { useEffect, useMemo } from 'react'
import { EditorStore } from '@buildapp/editor'
import { createDemoBuilding } from '@buildapp/demo'
import { StoreContext } from './use-store.js'
import { Toolbar } from './components/Toolbar.js'
import { Outliner } from './components/Outliner.js'
import { Viewport } from './components/Viewport.js'
import { Inspector } from './components/Inspector.js'
import { StatusBar } from './components/StatusBar.js'

/**
 * BuildWorld. The store is created once with the demo building — which is a
 * CanonicalBuildingModel produced by the Building DSL, never a hand-built
 * scene — and every panel reads from and writes to that store.
 */
export function App(): JSX.Element {
  const store = useMemo(() => new EditorStore(createDemoBuilding()), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        store.redo()
      } else if (e.key === 'Escape') {
        store.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        <Toolbar />
        <Outliner />
        <Viewport />
        <Inspector />
        <StatusBar />
      </div>
    </StoreContext.Provider>
  )
}
