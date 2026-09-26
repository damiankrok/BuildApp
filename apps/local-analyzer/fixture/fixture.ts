/**
 * TEST WIRING ONLY — never in the APK the owner installs.
 *
 * The in-memory synthetic publisher (`@buildapp/synthetic-drawings`), wired as
 * a local analyzer's publishers, so the production `analyzer.mjs` can be run
 * end to end without the internet: on the desktop by the parity tests, and on
 * an Android emulator by the instrumentation test, which ships this bundle in
 * the test APK only. The project `hangs` never answers for its drawings, so a
 * cancel can be proved while a fetch is outstanding.
 */
import { HOLLOWAY, LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'

export type FixtureWiring = { adapters: ReturnType<typeof syntheticPublisher>['adapter'][]; deps: ReturnType<typeof syntheticPublisher>['deps'] }

export const FIXTURE_PROJECTS = { larchfield: 'larchfield-lf01', holloway: 'holloway-hw02', hangs: 'hangs' } as const

export function fixtureWiring(): FixtureWiring {
  const publisher = syntheticPublisher({
    projects: [
      { code: FIXTURE_PROJECTS.larchfield, title: 'Larchfield', house: LARCHFIELD },
      { code: FIXTURE_PROJECTS.holloway, title: 'Holloway', house: HOLLOWAY },
      { code: FIXTURE_PROJECTS.hangs, title: 'Never answers', house: LARCHFIELD },
    ],
    beforeRespond: (url, signal) =>
      url.includes('/sheets/hangs/')
        ? new Promise<void>((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }))
        : undefined,
  })
  return { adapters: [publisher.adapter], deps: publisher.deps }
}

export const fixturePageUrl = (code: string): string => `https://drawings.synthetic-publisher.test/projects/${code}`
