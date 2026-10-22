/**
 * N7-COUNCIL-001: every production function reachable from `runAnalysis`, via the TypeScript Compiler API, with
 * heuristic flags. RESEARCH ONLY; reads the source, writes JSON outside the repository.
 *   npx vite-node research/analyzer-n7-council/inventory/reach.ts -- <out.json>
 */
import ts from 'typescript'
import { writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../..')
const cfg = ts.readConfigFile(resolve(ROOT, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const isProd = (f: string): boolean => /\/(packages|apps)\/[^/]+\/src\//.test(f) && !f.includes('node_modules') && !/\.test\.ts$/.test(f)
type Fn = ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression
const nameOf = (n: ts.Node): string => {
  if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) return n.name.getText()
  const p = n.parent
  if (p && ts.isVariableDeclaration(p)) return p.name.getText()
  if (p && ts.isPropertyAssignment(p)) return p.name.getText()
  return '<anon>'
}
const key = (n: ts.Node): string => `${relative(ROOT, n.getSourceFile().fileName)}#${nameOf(n)}@${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}`
// top-level functions only (module scope or exported const arrows); nested closures are attributed to their parent
const isTopLevel = (n: ts.Node): boolean => {
  if (ts.isFunctionDeclaration(n)) return ts.isSourceFile(n.parent)
  if (ts.isMethodDeclaration(n)) return true
  const p = n.parent
  return !!p && ts.isVariableDeclaration(p) && ts.isVariableDeclarationList(p.parent) && ts.isVariableStatement(p.parent.parent) && ts.isSourceFile(p.parent.parent.parent)
}
const declOf = (expr: ts.Expression): ts.Node | undefined => {
  let s = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr)
  if (!s) return undefined
  if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s)
  const d = s.valueDeclaration ?? s.declarations?.[0]
  if (!d) return undefined
  if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d
  if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer
  return undefined
}
const start = program.getSourceFiles().find((f) => f.fileName.endsWith('packages/analysis-service/src/run.ts'))
let root: ts.Node | undefined
start?.forEachChild(function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.getText() === 'runAnalysis') root = n })
if (!root) throw new Error('runAnalysis not found')
type Rec = { key: string; file: string; name: string; line: number; lines: number; callees: string[]; flags: Record<string, number> }
const recs = new Map<string, Rec>()
const queue: ts.Node[] = [root]
while (queue.length) {
  const fn = queue.shift() as Fn
  const k = key(fn)
  if (recs.has(k)) continue
  const sf = fn.getSourceFile()
  const text = fn.getText()
  const callees = new Set<string>()
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const d = n.expression ? declOf(n.expression) : undefined
      if (d && isProd(d.getSourceFile().fileName)) {
        // attribute nested functions to their top-level owner
        let owner: ts.Node | undefined = d
        while (owner && !isTopLevel(owner)) owner = owner.parent
        const target = owner && (ts.isVariableStatement(owner) ? undefined : owner)
        const t = (target ?? d) as ts.Node
        callees.add(key(t))
        queue.push(t)
      }
    }
    // a function passed by reference (callbacks) counts as reachable
    if (ts.isIdentifier(n) && !ts.isCallExpression(n.parent)) {
      const d = declOf(n)
      if (d && d !== fn && isProd(d.getSourceFile().fileName) && isTopLevel(d)) { callees.add(key(d)); queue.push(d) }
    }
    n.forEachChild(visit)
  }
  fn.forEachChild(visit)
  const count = (re: RegExp): number => (text.match(re) ?? []).length
  recs.set(k, {
    key: k,
    file: relative(ROOT, sf.fileName),
    name: nameOf(fn),
    line: sf.getLineAndCharacterOfPosition(fn.getStart()).line + 1,
    lines: text.split('\n').length,
    callees: [...callees].sort(),
    flags: {
      returnUndefined: count(/return undefined\b|return\s*$|return;/gm),
      returnNull: count(/return null\b/g),
      returnEmpty: count(/return \[\]/g),
      nullishFallback: count(/\?\?/g),
      conventions: count(/CONVENTIONS\./g),
      assumed: count(/ASSUMED_FOR_RENDERING|DISPLAY_ASSUMPTION|UNRESOLVED/g),
      geometryWrite: count(/\b(x0|x1|z0|z1|interval|widthM|sillY|headY|openSide|wallThicknessM|storeyRects)\s*[:=](?!=)/g),
      gapOrStep: count(/\bgap\(|\bstep\(/g),
      throws: count(/\bthrow\b/g),
      continueSkip: count(/\bcontinue\b/g),
    },
  })
}
const out = process.argv[process.argv.length - 1]
const list = [...recs.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
writeFileSync(out, JSON.stringify(list, null, 1))
const byPkg: Record<string, number> = {}
for (const r of list) { const p = r.file.split('/').slice(0, 2).join('/'); byPkg[p] = (byPkg[p] ?? 0) + 1 }
console.log(list.length, 'reachable functions'); console.log(byPkg)
