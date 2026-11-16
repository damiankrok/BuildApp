/**
 * v3.54.1: before any billed request — does each house reach its first question on these bytes? The product's
 * runDescribedAnalysis with a reader that records the request and answers nothing (an empty replay), so nothing is
 * sent. Prints per house: pictures decoded and asked about, request size, and the reservation the books would make.
 *   npx vite-node research/source-to-model/v3541/dry-run.ts -- <list file>
 */
import { readFileSync } from 'node:fs'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import type { StructuredVision } from '@buildapp/source-vision'
import { identityOf, runDescribedAnalysis } from '@buildapp/analysis-service'
import { HOUSE_READER_PRICES, reservationUsd } from '../../../apps/analyzer-api/src/house-reader-spend.js'
import { CAMPAIGN_MODELS } from './campaign.js'
import { parseHouseList } from './campaign-run.js'

const [list] = process.argv.slice(2).filter((a) => a !== '--')

async function main(): Promise<void> {
  for (const { house, pkgPath, cacheDir } of parseHouseList(readFileSync(list, 'utf8'))) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as SourcePackage
    let seen: { purpose: string; pictures: number; bytes: number; chars: number; reserveUsd: number } | null = null
    const reader: StructuredVision = {
      provider: { id: 'dry-run', model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage, version: 'dry', maxOutputTokens: { HOUSE_TRIAGE: 4096, HOUSE_DESCRIPTION: 16000 } },
      available: () => true,
      ask: async (request) => {
        const price = HOUSE_READER_PRICES[request.purpose === 'HOUSE_TRIAGE' ? CAMPAIGN_MODELS.triage : CAMPAIGN_MODELS.description]
        seen = { purpose: request.purpose, pictures: request.pictures.length, bytes: request.pictures.reduce((s, p) => s + p.bytes.byteLength, 0), chars: request.system.length + request.text.length, reserveUsd: price ? reservationUsd(request, request.purpose === 'HOUSE_TRIAGE' ? 4096 : 16000, price) : -1 }
        throw new HouseReaderUnavailable('FIXTURE_MISS', 'dry run: nothing is sent')
      },
    }
    try {
      await runDescribedAnalysis({ pkg, cache: fileByteCache(cacheDir), reader, identity: identityOf(pkg) })
      console.log(JSON.stringify({ house, unexpected: 'a model without any answer' }))
    } catch (e) {
      console.log(JSON.stringify({ house, firstQuestion: seen, stoppedBy: String((e as Error).message).slice(0, 120) }))
    }
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
