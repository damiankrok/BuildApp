/**
 * SOURCE-01: the image-content encoder's contract — refused unless its file is the pinned bytes; 1280 finite values
 * per picture; the same values twice, and the same in the worker the phone runs as on the calling thread.
 */
import { describe, expect, it } from 'vitest'
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IMAGE_ROLE, inlineImageEmbedder, openImageRoleEngine, workerImageEmbedder, workspaceImageRolePaths } from '../src/index.js'
// @ts-expect-error — a plain ES module without type declarations
import { bundleImageRoleWorker } from '../build.mjs'

const tensor = (seed: number): Float32Array => {
  const t = new Float32Array(3 * 224 * 224)
  for (let i = 0; i < t.length; i += 1) t[i] = Math.sin(i * 0.001 + seed) * 2
  return t
}

describe('SOURCE-01 the image-content encoder', () => {
  it('gives 1280 finite values, the same twice', async () => {
    const e = inlineImageEmbedder(workspaceImageRolePaths())
    const [a, b] = await e.embed([tensor(1), tensor(1)])
    await e.release()
    expect(a.length).toBe(IMAGE_ROLE.output.values)
    expect(a.every(Number.isFinite)).toBe(true)
    expect(Array.from(a)).toEqual(Array.from(b))
  }, 120_000)

  it('refuses a model file that is not the pinned bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'image-role-'))
    const paths = workspaceImageRolePaths()
    const bad = join(dir, IMAGE_ROLE.file)
    copyFileSync(paths.model, bad)
    writeFileSync(bad, 'x', { flag: 'a' })
    await expect(openImageRoleEngine({ ...paths, model: bad })).rejects.toThrow(/refused/)
  }, 60_000)

  it('the worker the phone runs gives the same values as the calling thread', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'image-role-worker-')), 'image-role-worker.mjs')
    await bundleImageRoleWorker(out)
    const w = workerImageEmbedder({ workerUrl: pathToFileURL(out), paths: workspaceImageRolePaths() })
    const i = inlineImageEmbedder(workspaceImageRolePaths())
    const [a] = await w.embed([tensor(7)])
    const [b] = await i.embed([tensor(7)])
    await i.release()
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(w.stats()[0]).toMatchObject({ images: 1, mode: 'WORKER' })
  }, 180_000)
})
