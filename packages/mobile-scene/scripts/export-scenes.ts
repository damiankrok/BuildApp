/**
 * `npm run mobile:export-scenes` — write the mobile scene assets.
 *
 * Output is deterministic: rerunning with an unchanged model rewrites the same
 * bytes, so a rebuild shows up as no diff. The script proves that on every run
 * rather than leaving drift to be discovered later.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMobileSceneBundle, serializeBundle } from '../src/index.js'
import { ASSET_DIR, ROOT, SCENES, type SceneIndexEntry } from './scenes.js'

function main(): void {
  mkdirSync(ASSET_DIR, { recursive: true })
  const index: SceneIndexEntry[] = []

  for (const spec of SCENES) {
    const bundle = buildMobileSceneBundle(spec.build())
    const asset = `${spec.key}.scene.json`
    const text = serializeBundle(bundle)
    writeFileSync(join(ASSET_DIR, asset), text, 'utf8')
    index.push({
      key: spec.key,
      title: spec.title,
      subtitle: spec.subtitle,
      asset,
      modelId: bundle.generatedFrom.modelId,
      modelSchemaVersion: bundle.generatedFrom.modelSchemaVersion,
      contentHash: bundle.contentHash,
      meshCount: bundle.scene.stats.meshCount,
      triangleCount: bundle.scene.stats.triangleCount,
      objectCount: bundle.scene.stats.objectCount,
    })
    const kb = (Buffer.byteLength(text, 'utf8') / 1024).toFixed(0)
    process.stdout.write(
      `${spec.key.padEnd(10)} ${bundle.scene.stats.meshCount} meshes  ${bundle.scene.stats.triangleCount} triangles  ` +
        `${bundle.scene.stats.objectCount} objects  ${kb} kB  ${bundle.contentHash.slice(0, 16)}…\n`,
    )
  }

  writeFileSync(join(ASSET_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')
  process.stdout.write(`\nwrote ${index.length} scene bundles to ${ASSET_DIR.replace(ROOT, '.')}\n`)

  for (const entry of index) {
    const spec = SCENES.find((s) => s.key === entry.key)
    if (!spec) continue
    if (serializeBundle(buildMobileSceneBundle(spec.build())) !== readFileSync(join(ASSET_DIR, entry.asset), 'utf8')) {
      process.stderr.write(`\nEXPORT IS NOT DETERMINISTIC for ${entry.key}\n`)
      process.exit(1)
    }
  }
}

main()
