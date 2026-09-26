import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { EditorStore } from '@buildapp/editor'
import { createDemoBuilding } from '@buildapp/demo'
import { StoreContext } from './use-store.js'
import { Toolbar } from './components/Toolbar.js'
import type { RightPanel } from './components/Toolbar.js'
import { Outliner } from './components/Outliner.js'
import { Viewport } from './components/Viewport.js'
import { Inspector } from './components/Inspector.js'
import { StatusBar } from './components/StatusBar.js'
import { Sources } from './components/Sources.js'
import { Analyzer } from './components/Analyzer.js'

/**
 * BuildWorld. The store is created once with the demo building — which is a
 * CanonicalBuildingModel produced by the Building DSL, never a hand-built
 * scene — and every panel reads from and writes to that store.
 */
export function App(): JSX.Element {
  const store = useMemo(() => new EditorStore(createDemoBuilding()), [])
  // The right-hand column shows the model, the sources it came from, or the
  // analyzer service. They are deliberately separate surfaces: the model can
  // be edited, the observations cannot, and the analyzer only ever hands the
  // store a whole model it made.
  const [panel, setPanel] = useState<RightPanel>('inspector')

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
        <Toolbar panel={panel} onPanel={setPanel} />
        <Outliner />
        <Viewport />
        {panel === 'inspector' ? <Inspector /> : panel === 'sources' ? <Sources /> : <Analyzer />}
        <StatusBar />
      </div>
    </StoreContext.Provider>
  )
}
