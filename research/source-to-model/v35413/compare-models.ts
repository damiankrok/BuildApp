import { readFileSync } from 'node:fs'
import { parseModel, validateModel } from '@buildapp/model'
import { usableGeometryFingerprint } from '/home/user/BuildApp/packages/analysis-service/src/appearance/index.js'
const [a, ...rest] = process.argv.slice(2).filter((x) => x !== '--')
const A = parseModel(readFileSync(a, 'utf8')) as unknown as Record<string, unknown>
for (const p of rest) {
  const B = parseModel(readFileSync(p, 'utf8')) as unknown as Record<string, unknown>
  const v = validateModel(B)
  const diff = Object.keys(A).filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]))
  const detail = diff.filter((k) => Array.isArray(A[k])).map((k) => {
    const ia = new Map((A[k] as Array<{ id: string }>).map((x) => [x.id, JSON.stringify(x)]))
    const ib = new Map((B[k] as Array<{ id: string }>).map((x) => [x.id, JSON.stringify(x)]))
    const ch = [...new Set([...ia.keys(), ...ib.keys()])].filter((id) => ia.get(id) !== ib.get(id))
    return `${k}[${ch.length}: ${ch.slice(0, 4).join(',')}]`
  })
  console.log(p.split('/').slice(-2).join('/'), 'valid', v.ok, 'fingerprint', usableGeometryFingerprint(B as never).slice(0, 12), 'vs A', usableGeometryFingerprint(A as never).slice(0, 12), 'differs:', detail.join(' '), diff.filter((k) => !Array.isArray(A[k])).join(','))
}
