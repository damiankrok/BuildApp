# STAGE BUILDPLAN-ANALYZER-005V-N5 — ELEVATION OPENING HEIGHT

**Werdykt: `NO_SAFE_OPENING_HEIGHT_FIX`. Zero zmian produkcyjnych.**

`OWNER_VISUAL_NOT_RETESTED`; `VISUAL_NOT_VERIFIED` (rendery nie uruchomione, bo geometria się nie zmienia).

| | |
| --- | --- |
| Baza | `631b2481ffdb40e659dbe47327fe6e351c0934a6`; worktree czysty, bez dryfu |
| Gałąź | `analyzer/005v-n5-elevation-opening-height-v1`, jeden commit |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e…`, nietknięty |
| Nietknięte | `main`, `owner-preview-latest`, wydania |
| Źródło | prywatne rastry z cache zapieczętowanego N1v dla `m60124f28f071a`; bez pikseli w repo, bez pobierania, bez OCR |
| Łatki N3 i N4 | nie zastosowane do drzewa. Rejestracja N4 posłużyła tylko diagnostycznie, jako ramka do rzutowania kolumn |

**Zmienione ścieżki:**
- `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N5_ELEVATION_OPENING_HEIGHT.md`
- `research/analyzer-005v-n5-opening-height/preregistration.md`
- `research/analyzer-005v-n5-opening-height/ledger.json`
- `research/analyzer-005v-n5-opening-height/trace-summary.ndjson`
- `PROJECT_STATUS.md`

## FIRST_BAD: `verticalOpeningExtent` (`packages/image-metrology/src/opening.ts`)

Ścieżka: ramka FRONT `…elewacja-b74ed2020b` + raster → (diagnostycznie) rejestracja na pasie ściany z N4 →
`elevationFrameFromV2` → `elevationExtent` → `verticalOpeningExtent`.

Jak działa czytnik:
- w każdym wierszu porównuje medianę **szarości** pasa otworu z medianą wąskich pasków ściany po obu stronach i bierze
  mniejszą z dwóch różnic;
- Otsu dzieli wiersze na „ściana” i „otwór”;
- otworem jest najdłuższy ciągły przebieg.

Dlaczego zawodzi na tym renderze:
1. **Żaluzje i odbicia.** Wiersze na szybie są na przemian jaśniejsze i ciemniejsze od szarej ściany. Różnica szarości
   spada poniżej progu w wielu wierszach i przebieg się rwie. Dla 100/220 zostaje tylko dolna, ciemna część.
2. **Otsu na wielopoziomowym profilu szkła** stawia próg wysoko (mediana otworu 45–97/255). Umiarkowanie różne wiersze
   szkła trafiają do „ściany”.
3. **Paski odniesienia.** Dla 250/220 lewy pasek wypada za krawędź ściany, od strony pergoli. Dla 90/210 lewy pasek
   leży na drewnianym panelu przy wejściu. Rozrzut ściany (8–19) zasłania wtedy szkło.
4. **Próg okna (dół otworu).** Dolna rama zlewa się z cokołem i ciemnymi odbiciami. Żaden wariant jej nie oddziela.

## Warianty sprawdzone (diagnostycznie; liczby w `trace-summary.ndjson`)

Ręczne odczyty (wyłącznie do oceny, nigdy jako wartości produkcyjne): 250/220 i 100/220 sięgają ~0–2,20 m, a 105/210
i 90/210 ~0–2,10 m.

| otwór | szarość + Otsu (jak produkcja) | RGB + Otsu | RGB + limit rozrzutu ściany | linia ramy |
| --- | --- | --- | --- | --- |
| 250/220 | szum ~1,05–1,09 | 1,80–1,94 | ~1,0 (szum) | nadproże 2,11, bez progu |
| 100/220 | 0,05–0,88 | 0,05–0,88 | **−0,06–2,11** | nadproże 2,11 |
| 105/210 | −0,06–0,17 | 0,98–1,27 | −0,06–1,85 | nadproże 2,11 |
| 90/210 | 0,08–0,30 | 1,36–1,89 | **1,27–1,89 (fałszywe pasmo okna)** | nadproże 2,11 |

Wartości w metrach, w ramce diagnostycznej N4 (0,017045 m/px).

**Wynik:**
- 1 z 4 otworów poprawny (100/220, wariant RGB + limit rozrzutu);
- 1 częściowy (105/210, nadproże 0,25 m za nisko);
- 1 szkodliwy: na 90/210 każdy wariant czyta pasmo 1,3–1,9 m i zastąpiłby pełną wysokość 0–2,10 m oknem 0,6 m;
- 1 nieczytelny (250/220).

Linia ramy daje spójne nadproże na wszystkich czterech (wiersz 477, 2,11 m), ale żadnego progu.

Kryteria z `preregistration.md` (żaden otwór gorzej, 90/210 bez fałszywego pasma, 250/220 bez założonego progu) nie są
spełnione. Faza A nie daje bezpiecznej zmiany, więc fazy B (N4 jako zasilanie otworów) i C (szklenie z N3) nie były
uruchamiane.

## Kontrole i testy

- Commitowane drzewo = baza, więc każdy model ma hash bazy: A01 `d93291577e2d…`, Goździkowce `911456a88b25…`, Marcówki
  `f607464936c7…`, Rarytasy G2E `9f5fd342a53e…`, Cieszynianki `e4e562923319…`. Replay nie był potrzebny.
- Rarytasy OWNER `m3ea…`: `NOT_RUN`.
- Testy: brak nowego kodu i testów do uruchomienia. Bramka rozmiaru APK nadal czerwona (39 556 682 B > 32 MB,
  `KNOWN_BASELINE_FAIL`), bez `ALL_GREEN`.
- CI, APK, e2e i emulator: `NOT_RUN`.

## Proponowany następny minimalny krok (decyzja koordynatora; nie rozpoczęty)

Czytnik o dwóch niezależnych krawędziach:
- **nadproże** z linii ramy na całą szerokość pasa (spójne na 4/4);
- **próg** z miejsca, gdzie różnica pasa od ściany styka się z linią cokołu;
- paski odniesienia wybierane wyłącznie na pikselach ściany (odrzucenie paska, który różni się od ściany nad otworem).

Preregistracja: FRONT + REAR A01 i co najmniej jedna zarejestrowana elewacja innego domu, z syntetycznymi negatywami
(żaluzje, odbicia, pergola, pusta ściana, słupki).

STOP.
