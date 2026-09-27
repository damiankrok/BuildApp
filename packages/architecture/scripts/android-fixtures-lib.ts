/**
 * The mobile scene bundles of four
 * synthetic diversity fixtures, written as Android TEST resources
 * (apps/android/app/src/test/resources/architecture/), so the phone's parser
 * and renderer are held to the 1.6.0 parts and groups without the APK
 * shipping a fixture. Deterministic: an unchanged fixture rewrites the same
 * bytes, and packages/architecture/test/android-fixtures.test.ts fails when
 * a committed bundle is stale.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { buildFixture, fixtureById } from '../src/fixtures/index.js'

export const ANDROID_FIXTURES = ['exterior-pergola', 'exterior-entrance-canopy', 'roof-dormer-gable', 'unknown-feature'] as const
export const ANDROID_FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../apps/android/app/src/test/resources/architecture')

export const androidFixtureBundle = (id: string): string => serializeBundle(buildMobileSceneBundle(buildFixture(fixtureById(id))))

