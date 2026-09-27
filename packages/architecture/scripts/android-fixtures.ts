/** `npm run architecture:android-fixtures` — write the Android test-resource bundles (see android-fixtures-lib.ts). */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANDROID_FIXTURES, ANDROID_FIXTURE_DIR, androidFixtureBundle } from './android-fixtures-lib.js'

mkdirSync(ANDROID_FIXTURE_DIR, { recursive: true })
for (const id of ANDROID_FIXTURES) writeFileSync(join(ANDROID_FIXTURE_DIR, `${id}.scene.json`), androidFixtureBundle(id))
console.log(`wrote ${ANDROID_FIXTURES.length} bundles to ${ANDROID_FIXTURE_DIR}`)
