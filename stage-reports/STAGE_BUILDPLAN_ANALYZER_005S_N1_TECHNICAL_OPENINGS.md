# STAGE BUILDPLAN-ANALYZER-005S-N1-TECHNICAL-OPENINGS — techniczne otwory z elewacji (jeden ograniczony etap)

**Werdykt: `NO_SAFE_TECHNICAL_OPENING_CANDIDATE`.** Zero zmian produkcyjnych (`packages/`, `apps/`, `android/`,
`.github/` bajt w bajt jak w bazie). Bez CI, bez lustra, bez APK, bez ślepej rundy, bez 005S-N2.

- Baza: `7ceb4b09dd88bb528507779571add74a358bc696` (`analyzer/exterior-owner-truth-review-pack-v1`); preflight: HEAD =
  origin = baza, drzewo czyste, brak `BASE_DRIFT`. Lustro `claude/new-session-3kzcgh` nietknięte (`bfaf286…`).
- Gałąź: `analyzer/005s-technical-openings-n1`, jeden commit zamykający (ten raport, `PROJECT_STATUS.md`, katalog
  badawczy `research/analyzer-005s-openings/`).

## 1. Intake eksportu OWNER-a (tylko podsumowanie, nie prawda geometryczna)

Surowe pliki eksportu (JSON SHA-256 `0882a287…c5bd`, CSV `a07294b7…a97a3`, pieczęć `5e49fe55…44c1`, kolejka
`215e18bd…de76`) **nie były dostępne w tym środowisku**; przyjęto zweryfikowane przez koordynatora podsumowanie (paragon
v2.95.0). Nic z eksportu nie trafiło do repozytorium ani do geometrii.

| | liczba |
| --- | --- |
| odpowiedzi | 60 / 60 |
| widoczność cech | 43: `ABSENT` 29, `PRESENT` 12, `NOT_SHOWN` 2 |
| scena | 17, wszystkie `EXTERIOR` (w tym 6 klatek `INTERIOR_FRAME` i 2 `STRUCTURE_CONFLICT_FRAME` wg zapieczętowanego `crosscheck.json`) |
| tryb oglądania | 60 × `MANUAL_PAGE_FALLBACK_NOT_BLIND`; 0 zweryfikowanych skrótów bajtów; 0 kontroli technicznych (`phase2 = null`) |

Interpretacja: komentarz człowieka do stron oglądanych w przeglądarce, **nie** niezależna prawda wizualna. 29 `ABSENT`
łączy „nie widać na tym obrazie” i „nie ma w projekcie” (wyjaśnienie OWNER-a) → metadana `AMBIGUOUS_NEGATIVE`, odpowiedzi
surowe bez zmian. 17 × `EXTERIOR` jest niezgodne z 8 klatkami wnętrz/konfliktu → żadnej trafności klas nie liczę.
`m3ea28300f9b3e` ≠ `m84f2903cb8e14` bez zmian.

## 2. Gdzie w ścieżce produkcyjnej powstaje otwór (odczyt kodu w bazie)

- `reconstruct-v2.ts` (G5/H) czyta otwory ściana po ścianie: **pozycja i szerokość z przerwy w rzucie** (+ szerokość
  z drukowanej sygnatury `szer/wys`), a elewacja odpowiada wyłącznie za **parapet i nadproże** (`openings-v2.ts`
  `readWallOpenings` → `elevationExtent` po kolumnach przedziału z rzutu).
- Elewacja jest wiązana ze ścianą przez `registerElevationV2` (`v2/frame.ts`): bok z etykiety wydawcy lub proporcji,
  skala z szerokości obwiedni, wiersz zera z kalenicy; kierunek wzdłuż elewacji jest stały dla boku. Boki L/P są
  weryfikowane profilem dachu (`side-orientation.ts`). Przód/tył opiera się na założeniu `frontSide: 'SHEET_BOTTOM'`
  w `worldFrameFrom` — dół arkusza rzutu to front.
- Strażnik N1 (perspektywa → brak ekstraktorów fasady) nie jest dotykany; render perspektywiczny nie ma autorytetu.

## 3. Szukanie pierwszego złego kroku (dowody; bez otwierania pikseli)

Narzędzie: `research/analyzer-005s-openings/replay-reconstruct.ts` — tylko solver v2 na zapieczętowanym grafie obserwacji
i dowodach metrycznych z deweloperskiej powtórki N1 (bez OCR, bez sieci, bajty z istniejącego cache, nic nie zapisuje
w repo). **Odtwarza zapieczętowany model bajt w bajt** (np. `dom-w-cieszyniankach` `a96afbb1…1ad3` = N1v). Kontrola
całego zbioru (23 wiersze): §6.

| hipoteza | pomiar | wynik |
| --- | --- | --- |
| H1 elewacje domów z dachem kopertowym są odrzucane błędnie | 11 z 23 zbudowanych wierszy nie ma żadnej zarejestrowanej elewacji. Na `dom-w-cieszyniankach` (4 odmowy) obwiednie mają 204–205 px wysokości przy 757 px szerokości (front): dom 11,7 m × 7,2 m dałby ≈ 466 px — obrys to pas ścian bez dachu, więc dół wypadałby 3,99 m nad terenem (próg 0,9 m) | **odmowa poprawna**; zarejestrowanie tych obrysów byłoby niebezpieczne |
| H2 elewacja frontowa/tylna przypięta do złej ściany (`SHEET_BOTTOM`) | 21 zarejestrowanych widoków w 11 wierszach; dla każdego przerwy ze ściany przypisanej i przeciwległej (z odbiciem kierunku) oraz „ślepe” przedziały ściany sprawdzone tym samym czytnikiem (`binding-diagnostic.patch`) | przypisana: 31/72 trafień, przeciwległa: 25/74, puste odcinki: 5/36 i 9/40. Trzy widoki „wolą” przeciwległą ścianę, ale przy n ≤ 5 i sprzecznie w obrębie jednego domu (g2e: front woli przypisaną, tył przeciwległą — obrócony rzut odwróciłby oba) → **brak dowodu złego przypięcia i brak sygnału na tyle silnego, by zbudować na nim strażnika** |
| H3 otwór pominięty przy emisji | w 23 wierszach jeden otwór odrzucony: `rarytasy-g2e` `opening-0-east-5-1` (`OPENINGS_OVERLAP`) — sąsiednia przerwa 3,80 m poszerzona do drukowanych 410 cm wokół środka nachodzi na nią o 0,12 m | **jeden przypadek, nie z elewacji** (ta przerwa nie była czytana na elewacji); bez obejrzenia rysunku nie da się rozstrzygnąć, czy to dwa otwory, czy jeden ze słupkiem — każda poprawka byłaby założeniem |

**Pierwszy zły krok — blokada:** w tym korpusie elewacje ARCHON to rendery fotorealistyczne, a jedyny czytnik otworów
na nich to pasmo kontrastu (`verticalOpeningExtent`), które na zarejestrowanych widokach trafia 43 % przerw z rzutu
i 14–22 % pustych odcinków ściany. Pozycja i szerokość otworu już pochodzą z dwóch źródeł technicznych (przerwa w rzucie
+ drukowana sygnatura), więc elewacja nie ma tu czego „przesunąć” na lepsze miejsce, a jej sygnał nie wystarcza, by
nadpisać rzut, wykryć odbicie lub dodać otwór. Brak niezależnej pary technicznej (rzut ↔ ortogonalna elewacja
liniowa z czytelną skalą) dla przypadku, w którym model myli ścianę.

## 4. Implementacja

**Brak.** Nie zmieniono żadnego pakietu. Nie dodano pergoli, wiat, daszków ani balustrad; odpowiedzi OWNER-a i kategorie
wydawcy nie dotknęły geometrii. Tymczasowe instrumentowanie (`DBG005S`) w `v2/frame.ts`, `v2/openings-v2.ts`
i `v2/reconstruct-v2.ts` zostało cofnięte; diagnostyka zachowana jako `research/analyzer-005s-openings/binding-diagnostic.patch`
(do ponownego uruchomienia, nie do przyjęcia).

## 5. Przed / po

Nie ma „po”: żadnej transformacji otworu nie wprowadzono, więc nie raportuję zysku 3D. Przykładowa obecna transformacja
(dla przyszłego etapu, w jednostkach technicznych): `rarytasy-g2e` `opening-0-front-0-2` — przerwa 2,48 m w ścianie
frontowej korpusu, sygnatura 250/110, elewacja frontowa (etykieta wydawcy) czyta 1,06–2,22 m → model:
offset 12,75 m, szerokość 2,50 m (`SOURCE_EXACT`), parapet 1,089 m, wysokość 1,10 m (`SOURCE_CORROBORATED`).

## 6. Kontrole i testy (budżet krótki)

| kontrola | wynik |
| --- | --- |
| powtórka solvera v2 na wszystkich 23 zbudowanych wierszach N1v w czystej bazie (`research/analyzer-005s-openings/controls-base.json`) | **23/23 modeli bajt w bajt jak zapieczętowane**; solver 2,1–9,4 s (mediana 4,9 s) |
| diagnostyka H1 (1 wiersz) i H2 (11 wierszy, 21 widoków) | jak w §3 |
| `npm test`, e2e, typecheck, 41 jobów CI, emulator, APK, replay 37×18, ślepa runda | NOT_RUN (bez zmian produkcyjnych nie ma czego bramkować) |
| czas | solver v2 2,1–9,4 s na wiersz (mediana 4,9 s) (x86_64, Node 22); ARM64: NOT_MEASURED |

Nie było zmian, więc przypadki znane-dobre (Marcówki, Rarytasy, Kosaćce), strażnik fałszywego tarasu 005Q i strażnik
N1 są niezmienione z definicji; ekran 3D Androida nie był uruchamiany.

## 7. Prawa źródła

Żaden obraz wydawcy nie był otwarty, pokazany ani wysłany do modelu; czytane były wyłącznie liczby z lokalnego cache
przez istniejący kod. Brak pobrań z sieci, wag i AI. Repozytorium dostaje kod badawczy i liczby — bez pikseli, HTML
i ścieżek do obrazów.

## 8. Dług (osobno, nie w tym etapie)

Etykieta wersji serwisu `1.1.0` i nieaktualna fikstura `apps/web/src/sample-observations.json` — bez zmian.

## 9. Jedna decyzja dla koordynatora

Otwory nie poprawią się bez **innego źródła technicznego**: czy następny etap ma (a) dodać czytnik **liniowych** elewacji
technicznych / przekrojów tam, gdzie wydawca je publikuje (np. PDF projektu), czy (b) skierować wysiłek na rejestrację
11 wierszy bez żadnej elewacji (obrys pasa ścian → rejestracja na okapie z drukowanej rzędnej okapu, z odmową przy
sprzeczności)? Bez tej decyzji nic nie startuje.

```
STAGE: BUILDPLAN-ANALYZER-005S-N1-TECHNICAL-OPENINGS
VERDICT: NO_SAFE_TECHNICAL_OPENING_CANDIDATE (zero production edits)
BRANCH: analyzer/005s-technical-openings-n1 (base 7ceb4b0; mirror untouched at bfaf286)
FULL_REPORT: stage-reports/STAGE_BUILDPLAN_ANALYZER_005S_N1_TECHNICAL_OPENINGS.md
FIRST_BAD: none safe — openings already placed by plan gap + printed callout; render-elevation contrast reader hits 43% of plan gaps and 14–22% of blank wall; no mis-bound facade shown on 21 registered views; 11/23 rows have no registrable elevation (checked case: wall-band-only extents, refusal correct)
OWNER_INTAKE: 60/60 NOT_BLIND, 0 byte-verified, 29 AMBIGUOUS_NEGATIVE, 17 EXTERIOR incl. 8 interior/conflict frames — not used as truth
FINAL_TOKEN: BUILDPLAN_ANALYZER_005S_N1_TECHNICAL_OPENINGS_NO_SAFE_TECHNICAL_OPENING_CANDIDATE
```
