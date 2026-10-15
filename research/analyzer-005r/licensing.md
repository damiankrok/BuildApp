# 005R licence and source matrix (RESEARCH ONLY)

Nothing below is adopted, shipped or added as a dependency. "Product status" answers one question: could this
component be recommended for a product without counsel? Brief §6: a candidate with unclear commercial usage is
`LICENSE_BLOCKED` and gets no product recommendation.

## Code and runtimes

| component | used by | version | licence (read from the installed package) | product status |
| --- | --- | --- | --- | --- |
| jpeg-js | V1 | 0.4.4 | BSD-3-Clause | already a production dependency; no change |
| pngjs | V1 | 7.0.0 | MIT | already a production dependency; no change |
| omggif | V1 | 1.0.10 | MIT | already a production dependency; no change |
| V1 features / rules / cues | V1 | this branch | repository code | research only; would need its own production stage |
| PyTorch (CPU wheel) | V2 | 2.11.0+cpu | BSD-3-Clause | research venv outside the repo (from 005M); not a product runtime on Android |
| transformers | V2 | 4.57.6 | Apache-2.0 | research venv only |
| tokenizers, safetensors | V2 | 0.22.2, 0.8.0 | Apache-2.0 (upstream; the wheel METADATA has no licence line) | research venv only |
| numpy, Pillow | V2, synthetic, manifests | 2.2.6 / 2.4.6, 12.3.0 | BSD-3-Clause, MIT-CMU | research only |
| Node.js | V1 | 22.22.2 and 18.20.4 (official tarball, SHA-256 checked against SHASUMS256.txt) | MIT | runtime of the APK is Node 18.20.4 |

## Weights

| model | role | revision / hash | weights licence | documented training data | product status |
| --- | --- | --- | --- | --- | --- |
| google/owlvit-base-patch32 | V2 (classifier for Task A, localizer for Task B) | `cbc355fb364588351c5d51c7f74465e8e7ec6f72`, `model.safetensors` sha256 `4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b`, 612 983 940 B | Apache-2.0 | model card: CLIP backbone trained "on publicly available image-caption data … crawling a handful of websites and … YFCC100M" (YFCC100M mixes CC licences, some non-commercial); detection heads fine-tuned on COCO (Flickr images under varied CC licences; annotations CC BY 4.0) and OpenImages | **LICENSE_BLOCKED** for product: weights are Apache-2.0, but the crawl is undisclosed and part of the disclosed data carries non-commercial terms; counsel needed. Research use only |
| Qwen3-VL-2B (V3) | not run | — | Apache-2.0 (005M) | undisclosed (005M licensing-matrix.md) | **NOT_RUN_PREVIOUS_005M_SAFETY**; not downloaded |

No weight, checkpoint or model file is committed; the isolation test scans for them.

## Sources

`stage-reports/artifacts/analyzer-005r/corpus/source-eligibility.json`. ARCHON (and one host republishing an ARCHON
project) is **USABLE_FOR_LOCAL_RESEARCH** (robots permit product pages; the shop terms contain no clause against
copying for local analysis). DobreDomy, Archipelag and Domy w Stylu are **SOURCE_NOT_USABLE** (their terms permit
copying and use of site materials only with consent). Publisher pixels stay in `/home/user/work005r` and never reach Git
or a remote API; only hashes, URLs and aggregate numbers are committed.
