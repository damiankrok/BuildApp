import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import type { TreeNode } from '@buildapp/editor'
import { useSnapshot, useStore } from '../use-store.js'

const KIND_ABBR: Record<string, string> = {
  building: 'BLD',
  level: 'LVL',
  room: 'RM',
  wall: 'WL',
  opening: 'OP',
  window: 'WIN',
  door: 'DR',
  slab: 'SLB',
  roof: 'RF',
  balcony: 'BAL',
  railing: 'RL',
  chimney: 'CH',
  stair: 'ST',
  material: 'MAT',
  constraint: 'CON',
  evidenceSource: 'SRC',
}

function Row({ node, depth, collapsed, toggle }: { node: TreeNode; depth: number; collapsed: Set<string>; toggle: (id: string) => void }): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const isGroup = node.id.includes(':') || node.id.startsWith('__')
  const selected = snap.selection === node.id
  const hidden = !isGroup && !store.isObjectVisible(node.id)
  const open = !collapsed.has(node.id)
  return (
    <li>
      <div
        className={`row${selected ? ' selected' : ''}${hidden ? ' hidden-object' : ''}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        data-testid={`tree-row-${node.id}`}
        onClick={() => {
          if (isGroup) toggle(node.id)
          else store.select(node.id)
        }}
        onDoubleClick={() => toggle(node.id)}
      >
        <span className="caret" onClick={(e) => { e.stopPropagation(); toggle(node.id) }}>
          {node.children.length > 0 ? (open ? '▾' : '▸') : ''}
        </span>
        <span className="kind">{KIND_ABBR[node.kind] ?? node.kind}</span>
        <span className="label" title={node.id}>
          {node.label}
        </span>
        {!isGroup && (
          <button
            className="eye"
            data-testid={`eye-${node.id}`}
            title={hidden ? 'Show' : 'Hide'}
            onClick={(e) => {
              e.stopPropagation()
              store.toggleHidden(node.id)
            }}
          >
            {hidden ? '○' : '●'}
          </button>
        )}
      </div>
      {open && node.children.length > 0 && (
        <ul className="tree">
          {node.children.map((c) => (
            <Row key={c.id} node={c} depth={depth + 1} collapsed={collapsed} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function Outliner(): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const tree = useMemo(() => store.sceneTree(), [store, snap.model])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['__materials', '__constraints', '__sources']))
  const toggle = (id: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return (
    <div className="outliner" data-testid="outliner">
      <div className="panel-title">Scene</div>
      <ul className="tree">
        {tree.map((n) => (
          <Row key={n.id} node={n} depth={0} collapsed={collapsed} toggle={toggle} />
        ))}
      </ul>
    </div>
  )
}
