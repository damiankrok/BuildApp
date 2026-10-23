# IU-01 — image understanding (research, offline)

Rozpoznawanie rodzaju obrazu źródłowego (rzut, elewacja ortogonalna, przekrój, perspektywa zewnętrzna, wnętrze, plan
sytuacyjny, detal, inne) **z pikseli**, z kalibracją, weryfikacją i uczciwym `UNKNOWN`. Kod badawczy; produkcja go nie
importuje (`tests/architecture/research-isolation.test.ts`, blok IU-01).

Piksele wydawcy, piksele Commons, osadzenia, wagi i dopasowana głowa leżą **poza repozytorium** (`$IU_WORK`, domyślnie
`/home/user/workiu01`). Każdy zapisujący skrypt odmawia ścieżki wewnątrz repozytorium (`REFUSED`).

## Środowisko (jednorazowo, ONLINE)

```bash
python3 -m venv $IU_WORK/venv
$IU_WORK/venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
$IU_WORK/venv/bin/pip install open_clip_torch timm onnx onnxruntime scikit-learn pillow numpy
IU_WEIGHTS=$IU_WORK/weights $IU_WORK/venv/bin/python prepare_models.py      # wagi + SHA-256
python3 -I data/fetch_commons.py --out $IU_WORK/commons --queries "$(cat $IU_WORK/commons-queries.json)"  # opcjonalne OOD
```

## Przebieg (OFFLINE — `offline_guard()` odrzuca każde połączenie i DNS)

```bash
PY=$IU_WORK/venv/bin/python
python3 build_derived.py                                   # kolaże, uproszczone elewacje, kopie 400/1200 px (per split)
$PY embed_corpus.py --images /home/user/work005r/corpus/images            # tag corpus
$PY embed_corpus.py --images $IU_WORK/derived --tag derived
$PY embed_corpus.py --images $IU_WORK/synth005r --tag synth005r
python3 geometry_corpus.py $IU_WORK/geo-corpus.json /home/user/work005r/corpus/images $IU_WORK/derived
$PY evaluate.py                                            # A / B0 / B / C / C2, kalibracja, progi, TEST, negatywy, artefakt modelu
$PY bench.py mobilenetv3_large_100                         # czasy, RAM, eksport ONNX
```

## Prototyp

```bash
$PY iu_classify.py --folder <katalog obrazów> --out <katalog wyników>
$PY iu_classify.py --package <source-package.json> --cache <katalog cache bajtów> --out <katalog wyników>
```

Wynik: `classification.json` / `.csv` (hash, klasa, wyniki konkurencyjnych klas, model i wersja, skalibrowana pewność,
typowość, metadane wydawcy, sprawdzenie geometryczne, `ACCEPT` / `REVIEW` / `UNKNOWN` z przyczyną, czy obraz idzie do
ekstraktora fasad, A obok B i C), `set-checks.json` (kopie, warianty rzutów, brakujące widoki, perspektywy w slocie
elewacji, pary lustrzane; czego nie da się zmierzyć bez segmentacji — `NOT_MEASURED`) i `contact-sheet.jpg`.
Nic nie jest usuwane: obraz `UNKNOWN` zostaje w wynikach z hashem i metadanymi. Pakiet i jego hashe są tylko czytane.

## Pliki

- `audit/AUDIT.md`, `audit/metadata-hazards.ts` — audyt ścieżki produkcyjnej i negatywne przypadki na samych metadanych.
- `data/labels-archon.json` — etykiety 1352 obrazów ARCHON (klucz: SHA-256; bez URL, podpisów i pikseli).
- `iu/` — klasy, korpus i podział po projektach, backbone'y, głowa liniowa, zero-shot, sprawdzenie geometryczne,
  syntetyki, kontrole zestawu, strażnik ścieżek.
- `MODELS.md` — modele open source, licencje, rozmiary, ścieżka na Androida.
- Wyniki liczbowe: `stage-reports/artifacts/iu-01/`, raport: `stage-reports/STAGE_BUILDPLAN_IU_01_IMAGE_UNDERSTANDING.md`.
