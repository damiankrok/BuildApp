/**
 * tree.mjs — 005R V1 rule learner (RESEARCH ONLY; never imported by production).
 *
 * A depth-limited CART (Gini) over the named V1 features, fitted ONLY on the DEV family split by a fixed procedure,
 * then printed as human-readable rules. It is deliberately small: the rules are the V1 contender, so a reviewer must
 * be able to read every one of them.
 *
 * Determinism: rows are sorted by their id before fitting; candidate thresholds are the midpoints of consecutive
 * distinct sorted values; the split with the largest Gini decrease wins, ties broken by feature order and then by the
 * smaller threshold. No randomness anywhere.
 *
 * Abstention (preregistered): a prediction is UNRESOLVED when its leaf has fewer than MIN_LEAF_PREDICT DEV rows or a
 * majority share below PURITY. The leaf's purity on DEV is reported as an UNVALIDATED_SCORE, never as a probability.
 */
export const TREE_VERSION = 'v1-cart@1'
export const DEFAULTS = { maxDepth: 4, minLeaf: 5, purity: 0.9, minLeafPredict: 5 }

const gini = (counts, n) => {
  let s = 1
  for (const c of Object.values(counts)) s -= (c / n) ** 2
  return s
}
const countOf = (rows) => rows.reduce((m, r) => ((m[r.y] = (m[r.y] ?? 0) + 1), m), {})

function leaf(rows) {
  const counts = countOf(rows)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { leaf: true, n: rows.length, counts, label: sorted[0][0], purity: sorted[0][1] / rows.length }
}

export function fit(rowsIn, featureNames, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const rows = [...rowsIn].sort((a, b) => a.id.localeCompare(b.id))
  const grow = (rs, depth) => {
    const node = leaf(rs)
    if (depth >= o.maxDepth || node.purity === 1 || rs.length < 2 * o.minLeaf) return node
    const parent = gini(node.counts, rs.length)
    let best = null
    featureNames.forEach((f, fi) => {
      const vals = [...new Set(rs.map((r) => r.x[f]))].sort((a, b) => a - b)
      for (let k = 0; k + 1 < vals.length; k++) {
        const t = (vals[k] + vals[k + 1]) / 2
        const L = rs.filter((r) => r.x[f] <= t), R = rs.filter((r) => r.x[f] > t)
        if (L.length < o.minLeaf || R.length < o.minLeaf) continue
        const gain = parent - (L.length / rs.length) * gini(countOf(L), L.length) - (R.length / rs.length) * gini(countOf(R), R.length)
        if (!best || gain > best.gain + 1e-12 || (Math.abs(gain - best.gain) <= 1e-12 && (fi < best.fi || (fi === best.fi && t < best.t)))) best = { gain, f, fi, t, L, R }
      }
    })
    if (!best || best.gain <= 1e-9) return node
    return { leaf: false, f: best.f, t: Math.round(best.t * 1e6) / 1e6, n: rs.length, counts: node.counts, le: grow(best.L, depth + 1), gt: grow(best.R, depth + 1) }
  }
  return { version: TREE_VERSION, opts: o, features: featureNames, root: grow(rows, 0) }
}

export function predict(model, x) {
  let node = model.root
  const path = []
  while (!node.leaf) {
    const go = x[node.f] <= node.t
    path.push(`${node.f} ${go ? '<=' : '>'} ${node.t}`)
    node = go ? node.le : node.gt
  }
  const resolved = node.n >= model.opts.minLeafPredict && node.purity >= model.opts.purity
  const alternatives = Object.entries(node.counts).filter(([k]) => k !== node.label).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)
  return { label: resolved ? node.label : 'UNKNOWN', leafLabel: node.label, resolved, purity: Math.round(node.purity * 1e6) / 1e6, leafN: node.n, path, alternatives }
}

export function rules(model) {
  const out = []
  const walk = (node, conds) => {
    if (node.leaf) {
      const ok = node.n >= model.opts.minLeafPredict && node.purity >= model.opts.purity
      out.push(`IF ${conds.length ? conds.join(' AND ') : 'TRUE'} THEN ${ok ? node.label : `UNKNOWN (leaf ${node.label})`}   [DEV n=${node.n}, purity ${node.purity.toFixed(3)}, ${JSON.stringify(node.counts)}]`)
      return
    }
    walk(node.le, [...conds, `${node.f} <= ${node.t}`])
    walk(node.gt, [...conds, `${node.f} > ${node.t}`])
  }
  walk(model.root, [])
  return out
}
