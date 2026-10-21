/**
 * BUILDPLAN-ANALYZER-005Y-N6: a function-level inventory of the analyzer's critical path, read with the TypeScript
 * compiler API (no regex over source). For each named function, arrow function bound to a name, or method: its span in
 * lines, its deepest nesting of control-flow statements, and its count of branch points. RESEARCH ONLY.
 *
 *   npx vite-node research/analyzer-005y-n6/function-map.ts -- <out.json> <file.ts>...
 */
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

type Entry = { file: string; name: string; startLine: number; lines: number; maxNesting: number; branches: number }
const [out, ...files] = process.argv.slice(2).filter((a) => a !== '--')

const NESTING = new Set([ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement, ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.TryStatement])
const BRANCHES = new Set([...NESTING, ts.SyntaxKind.ConditionalExpression, ts.SyntaxKind.CaseClause, ts.SyntaxKind.CatchClause])

function measure(body: ts.Node): { maxNesting: number; branches: number } {
  let maxNesting = 0
  let branches = 0
  const walk = (n: ts.Node, depth: number): void => {
    // A nested function is measured on its own.
    if (n !== body && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n))) return
    if (BRANCHES.has(n.kind)) branches += 1
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) branches += 1
    const d = NESTING.has(n.kind) ? depth + 1 : depth
    maxNesting = Math.max(maxNesting, d)
    ts.forEachChild(n, (c) => walk(c, d))
  }
  walk(body, 0)
  return { maxNesting, branches }
}

const entries: Entry[] = []
for (const file of files) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true)
  const line = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1
  const visit = (n: ts.Node): void => {
    let name: string | undefined
    let fn: ts.Node | undefined
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && n.body) {
      name = n.name.getText(sf)
      fn = n
    } else if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      name = n.name.getText(sf)
      fn = n.initializer
    }
    if (name && fn) {
      const startLine = line(fn.getStart(sf))
      entries.push({ file, name, startLine, lines: line(fn.getEnd()) - startLine + 1, ...measure(fn) })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
entries.sort((a, b) => b.lines - a.lines)
writeFileSync(out, JSON.stringify(entries, null, 1))
for (const e of entries.filter((x) => x.lines >= 80 || x.maxNesting >= 6)) console.log(`${String(e.lines).padStart(5)} lines  nest ${e.maxNesting}  br ${String(e.branches).padStart(4)}  ${e.file}:${e.startLine} ${e.name}`)
