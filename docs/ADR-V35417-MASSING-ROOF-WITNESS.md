# ADR v3.54.17 — bryła, dach i wiązanie świadków ze źródłem

Status: przyjęte (v3.54.17). Poprzednik: `ADR-V35416-CORRECTION-EXECUTOR.md` (rejestr, wykonawca transakcyjny, bramka źródła).

## Kontekst

LOCAL bywa bez modelu (Layla: rzut przeczytany w potwierdzonej skali, ale kompozycja obrysu odrzucona `FOOTPRINT_AREA_WRONG`)
albo z modelem bez dachu / z błędnym dachem (Alaska: `roofs: []`, widoki tylko pozycyjne). Rejestr v3.54.16 umiał
otwory, kominy, parametry i wykończenie, ale nie umiał bryły ani formy dachu, a świadek wartości drukowanej wiązał się
z celem przez `includes` na nazwie (`host`) i przez liczenie dachów — co sonda z punktu kontrolnego obaliła
(`roof-main` przestawiony wartością z przekroju garażu).

## Decyzja

Jeden edytowalny model, te same komendy jądra, bez trzeciego H i bez reguł pod nazwy domów.

### Mapa: istniejące typy i komendy → nowe operacje

| Operacja (rejestr 1.1.0) | Wejście (obserwacje) | Komendy / typy jądra użyte | Dodane |
|---|---|---|---|
| `BUILD_MASSING` | `OutlineObservation` (obrys rzutu w metrach: odczyt API `plan-outline/1` w skali zmierzonej przez LOCAL albo ściany modelu), `SilhouetteObservation` (szkic elewacji: `groundRow`, strefy ścian, połacie) | `createBuilding`, `createLevel`, `createWallRing`, `createRoof` (GABLE z `capWallIds` → `FOLLOW_ROOF`; FLAT z attyką i `plateInset` od strony wolnej, 0 przy linii wspólnej), `addEvidenceSource`, `evidence` na komendzie (status per właściwość) | `massing/massing.ts` (`registerByPlan`, `rectanglesOf`, `solveMassing`, `bodyCommands`, `bodiesOf`), `massing/ops.ts` `bindBuildMassing` |
| `SET_ROOF` | szkic/recenzent: `roofKind`, `roofPolygon` (piksele źródła), opcjonalnie `side`, `wallLeftX/RightX`, `groundY` | `removeFeature` (dachy i połacie bryły, kaskada otworów dachowych), `setProperty` (`height`, `topProfile` ścian najwyższej kondygnacji), `createRoof` pod **tym samym id** (gdy był jeden dach) | `bindSetRoof`, `specSilhouette`, `bodyRoofSilhouette` |
| `SET_OUTLINE` | szkic/recenzent: `wallLeftX/RightX` na zarejestrowanej elewacji | jedna atomowa edycja modelu (`Bound.transform`, walidowana `validateModel` w całości: końce ścian pierścienia, `offset` otworów, `rect/outline` regionów wykończenia, `polygon` stropów i pomieszczeń) + `resizeFeature` (obrys dachu) | `bindSetOutline`, `Bound.transform` w wykonawcy |
| `SET_PARAMETER` (bez zmian w komendach) | świadek drukowany | `setProperty` | `correct/resolve.ts` (rozwiązywanie świadka → bryła), `PrintedWitness.box`, `datum` |

### Wiązanie świadka (resolver 1.0.0)

Świadek wiąże cel tylko wtedy, gdy oba stoją na tej samej bryle modelu: tekst wymiaru przez rejestrację własnej ramki
(piksele → metry wzdłuż strony) → bryła (`bodiesOf`: pierścienie ścian zewnętrznych z dachami/połaciami nad nimi; dach
bez pierścienia to też bryła); cel (dach/połać/ściana/komin/kondygnacja) → bryła. Nazwy (`host`) nie rozstrzygają niczego,
liczba dachów nie definiuje liczby brył. Poziom z odniesieniem `TERRAIN` / `STRUCTURAL_LEVEL` → `DATUM_MISMATCH`.
Świadek bez miejsca albo na ramce bez rejestracji w modelu wielobryłowym → `WITNESS_NOT_LOCATED`.

### Bramka (source-gate 1.2.0)

Hipotezy skali bryły (forma dachu, zasięg) rozstrzyga `compareRegions`: co pokrywa tylko propozycja i co tylko model,
wobec dominującego koloru tła ramki (papier/niebo). Propozycja wygrywa, gdy jej wyłączny obszar jest „materią rysunku”,
a obszar wyłącznie modelu tłem; odwrotnie wygrywa model; drzewo, cień, rysunek kreskowy bez wypełnienia → nie rozstrzyga.
Bramki pudełek i otworów bez zmian bajt w bajt.

### Orientacja osobno od pionu (§6)

Elewacja jest rejestrowana szerokością obrysu na swojej stronie (nie dachem modelu — brak pętli rejestracja↔korekta),
pion = poziom (rysunek izometryczny, `DISPLAY_ASSUMPTION`, sprawdzany zgodnością widoków). Gdy widoki przypisane jak
podpisano nie zgadzają się co do okapu, a obrócone o 90° tak — czytamy pod obrotem i nazywamy hipotezę; żadna ściana się
nie przesuwa. X i Y nie są skalowane niezależnie. Perspektywy nie są metryczne (`NOT_ORTHOGRAPHIC`).

### Zależności i atomowość

Zależne, które nie mogą pójść za zmianą (otwór ponad nowym okapem, otwór/region poza krótszą ścianą, linia wspólna z inną
bryłą, dach z połaci przy zmianie obrysu) odrzucają cały patch z nazwą. Grupa (`group`) stoi albo upada razem. Kolateralu
pilnuje porównanie skrótów obiektów; błędów domknięcia nie wolno zwiększyć.

### Zakres wspierany (zadeklarowany przed wynikami)

Prostokątna/ortogonalna bryła z rzutu; jeden dwuspad o stałej osi; dwie połączone bryły o niezależnych wysokościach
(dwuspad albo płaska dobudówka). Kopertowy, mansardowy, łukowy, trzecia bryła, ściany skośne → `UNSUPPORTED` z nazwą.

## Konsekwencje

- Ścieżka bez modelu daje `ConsultedAnalysis.massing` (model + scena + rekord); host nie dostaje jeszcze pełnej koperty
  `LinkAnalysisResult` dla takiego modelu — luka nazwana w raporcie.
- Kontrakt recenzenta 0.5.0 / prompt 0.6.0 (nowe operacje w liście generowanej z rejestru).

## R2 (domknięcie audytu, 2026-11-20)

- **Zapis wymiany przy odbiorze.** Każde żądanie i odpowiedź konsultanta jest zapisywane w chwili odbioru
  (`consult/exchange-log.ts`, `buildapp.consult-exchange` 1.0.0), także dla zadań FAILED/CANCELLED. Kopia surowa
  i kanoniczna są osobne. Zapis zawiera etap przyczyny po sanityzacji i nigdy sekretu ani nagłówka Authorization.
  Odtworzenie offline daje tę samą pierwszą stratę.
- **Księga badań atomowa** na istniejącym mechanizmie blokady hosta (`apps/analyzer-api/src/file-lock.ts`): rezerwacja
  jest wpisem na dysku, a rozliczenie jest idempotentne po `attemptId`.
- **Bryła bez LOCAL jest zwykłym wynikiem.** Wspólny adapter `programmed-result.ts` → `LinkAnalysisResult`. Recenzja
  końcowa widzi dostarczoną rewizję. Wnętrze NOT_CHECKED, ilości ≤ LIMITED. Konsekwencja „host nie dostaje koperty”
  z wersji pierwotnej przestaje obowiązywać.
- **Indeks elementów w wiadomości recenzenta** (`consult/element-index.ts` 1.0.0; kontrakt 0.6.0 / prompt 0.7.0,
  rejestr 1.2.0). `targetId` musi być id z indeksu. Brak wiązania i brak prymitywu to różne blokery.
- **Orientacja i pomiar per bryła** z przesłonięciem (`ops.ts` 1.1.0). Mapowanie TURNED_90 jest jedno i wspólne. Przy
  TURNED_90 otwory ze szkiców są pomijane z nazwą. Wiarygodność SET_ROOF jest sprawdzana przed komendą, bez przycinania.
