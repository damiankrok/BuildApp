/**
 * Recorded vision answers on disk.
 *
 * A fixture is a real provider answer, kept so CI can exercise the vision path
 * with no key and no network and get the same graph every time. It is keyed by
 * the BYTES it describes, so re-recording against a different image is a miss
 * rather than a silent mismatch.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fixtureKey } from '@buildapp/source-vision'
import type { VisionFixtureRecord, VisionTask, VisionTrace } from '@buildapp/source-vision'

export async function loadFixtures(dir: string): Promise<VisionFixtureRecord[]> {
  if (!existsSync(dir)) return []
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()
  const out: VisionFixtureRecord[] = []
  for (const name of names) out.push(JSON.parse(await readFile(join(dir, name), 'utf8')) as VisionFixtureRecord)
  return out
}

/** Write an accepted live answer as a fixture, so the same run can be replayed later without a key. */
export async function recordFixture(dir: string, trace: VisionTrace): Promise<void> {
  if (!trace.accepted || !trace.rawResponse) return
  let response: unknown
  try {
    response = JSON.parse(trace.rawResponse)
  } catch {
    return
  }
  const key = fixtureKey(trace.task as VisionTask, trace.assetByteHash)
  const record: VisionFixtureRecord = {
    key,
    task: trace.task as VisionTask,
    assetByteHash: trace.assetByteHash,
    recordedFrom: trace.provider,
    recordedNote: `recorded from a live ${trace.provider.id}/${trace.provider.model} call`,
    response,
  }
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${key}.json`), `${JSON.stringify(record, null, 2)}\n`)
}
