# BUILDPLAN-ANALYZER-005X-N2 — uogólnienie rekonstrukcji z jednego zdjęcia + pierwszeństwo rzutu

Data: 2026-10-20. Repo `damiankrok/BuildApp`, gałąź `analyzer/005x-n2-photo-generalization-plan-first-v1`.

## 0. Start

| element | stan |
|---|---|
| baza | `28cc5ee0f417dd8e4bb8861648f69e932d072610` na `analyzer/005x-n1-universal-photo-roof-openings-v1` (potwierdzony, worktree czysty) |
| `main` | **gałąź `main` nie istnieje w zdalnym repo**; domyślny HEAD zdalny to `claude/buildapp-buildworld-v1-7y6yqh` @ `c399a299` — nietknięty |
| mirror | `claude/new-session-3kzcgh` @ `bfaf286e95105c2cdb32df2d298d3cd93bd43449` — nietknięty |
| gałąź N2 | `analyzer/005x-n2-photo-generalization-plan-first-v1` — nie istniała, utworzona z 28cc5ee |
| APK / release / emulator / 41-job CI | nie uruchamiane, nie zmieniane |

Commity (kolejno): `8342c46` preregistration → `43aafef` zamrożenie BLIND-N2 → `5dc23fa` kod zamrożony przed ślepym biegiem → kolejne: decyzja po ślepym biegu, raport, ledger (SHA w ledgerze).

## 1. Cel i co zostało zrobione

FIRST BAD z N1: czytnik jednego zdjęcia wymagał jasnego, neutralnego pasa ściany tuż pod okapem i domu na tle nieba. Na
czterech wizualizacjach kontrolnych wynik końca N1 = 0/4.

Architektura N2 (wszystko w kodzie aplikacji, `packages/reconstruction/src/single-image/single-image.ts`):

1. **Warunek wstępny — niebo nad domem.** Obraz, którego górny pas (8 % wysokości) ma < 25 % nieba, jest odrzucany z nazwą
   (`no sky over the house…`) zanim jakikolwiek tryb „wymyśli” dach. Naprawia to istniejącą w N1 lukę: obraz bez nieba
   (zbliżenie ściany) dawał w N1 model z dachem z koloru ziemi (test syntetyczny to wykazał).
2. **Hipotezy w kolejności, nazwane w odczycie (`reading.mode`):**
   - `NEUTRAL_BAND` — dotychczasowy czytnik N1, **bez zmian** (zdjęcie OWNER-a i A01: modele bajt w bajt jak w N1).
   - `GENERAL` — gdy pasa nie ma: dach rozpoznawany po **własnym kolorze lokalnym** (średnia 7×7 — rzędy dachówek
     i znak wodny uśredniają się), rozrost regionu pokrycia z dwiema hipotezami (kolor obrazu / kolor kolumny — dach
     oświetlony nierówno), krawędź okapu przyjmowana tylko tam, gdzie pod nią stoi ściana (nie pokrycie, nie zieleń, nie
     niebo); hipoteza, która „wyciekła” po ciemnej ścianie do gruntu, jest wykrywana i odrzucana; niebo poszerzone
     o gładkie piksele koloru nieba w swoim wierszu (zmierzch); ściana dowolnego koloru (ciemna, drewniana); stopa —
     koniec fasady przed zielenią; rozpoznanie komina (wypustka konturu) blokuje fałszywe okno połaciowe przy kominie.
   - `SILHOUETTE` — gruba bryła z konturu domu na tle nieba (szczyt frontowy → kalenica w głąb). **Zaimplementowany,
     ale nieprzyjęty domyślnie** (patrz §4 — ślepy test). Dostępny tylko przez opcję `outlineFallback`.
3. **Poziom jakości (`reading.quality`):** `DETAILS_SUPPORTED` gdy odczytano otwory; `COARSE_INDICATIVE` gdy bryła bez
   otworów. Żaden odczyt nie dostaje „verified”. Przycisk `Photo…` w BuildWorld web pokazuje tryb i poziom.
4. **Proweniencja:** bez zmian — każda wartość `ASSUMED_FOR_RENDERING` / `VISUAL_INFERRED` / `VISUAL_SEMANTIC`, nigdy
   `SOURCE_EXACT`; nic nie trafia do przedmiaru ani kosztorysu; nazwa modelu `MODEL ORIENTACYJNY Z 1 ZDJĘCIA`.

Nic w kodzie nie zna nazwy projektu, domeny, pliku, hasha ani współrzędnych jednego obrazu. Progi są względne (udział
wysokości/szerokości obrazu, rozrzut koloru samego pokrycia).

## 2. Protokół i wskaźniki

Preregistration zapisana i zacommitowana przed obejrzeniem pikseli czterech obrazów kontrolnych
(`research/analyzer-005x-n2-photo-generalization/preregistration.md`, commit `8342c46`). Cztery obrazy kontrolne
są od N2 **zbiorem rozwojowym znanym wykonawcy** — nie hold-outem.

BLIND-N2: 4 nowe zdjęcia spoza ARCHON (Wikimedia Commons, CC BY / CC BY-SA), wybrane regułą z kategorii przed pobraniem,
zahashowane i zacommitowane (`blind-manifest.md`, commit `43aafef`) **przed** strojeniem; nieoglądane do biegu
na kodzie zamrożonym `5dc23fa`.

## 3. Wyniki — 6 obrazów rozwojowych

Kod końcowy; czas = mediana z 5 biegów w Node (800×600, bez dekodowania).

| obraz | N1 (28cc5ee) | N2 tryb / jakość | model | okap / stopa | dach (typ, oś) | główne otwory odczytane | fałszywe | geometria | czas |
|---|---|---|---|---|---|---|---|---|---|
| zdjęcie OWNER-a | model a478b5ff | NEUTRAL_BAND / DETAILS | **a478b5ff (=N1)** | jak N1 | kopertowy + wystawka (=N1) | brama, wejście, okno łukowe, 2 okna, 3 połaciowe (=N1) | 0 | 0 błędów, 1 ostrzeżenie NON_MANIFOLD (§6) | 1.34 s |
| wizualizacja A01 | model a32163dc | NEUTRAL_BAND / DETAILS | **a32163dc (=N1)** | jak N1 | dwuspadowy (=N1) | 4 otwory, 3 połaciowe (=N1) | 0 | 0 / 0 | 1.46 s |
| Goździkowce | odmowa | GENERAL / DETAILS | 68cf845d | okap przy rynnie ✓, stopa przy krzewach ✓ | dwuspadowy, kalenica wzdłuż frontu ✓ | duże okno ✓; drzwi i brama garażowa **nieodczytane**; 2 z 3 okien połaciowych ✓ | 0 | 0 / 0 | 1.62 s |
| Cieszynianki | odmowa | GENERAL / DETAILS | 1f9a015d | okap ✓, stopa przy tarasie ✓ | **kopertowy ✓** (HIP/HIP) | okna i przeszklenia tarasu częściowo ✓ | ok. 2 (trawy ozdobne odczytane jako „brama”, element wnętrza) + 1 połaciowe (litera znaku wodnego) | 0 / 0 | 1.54 s |
| Rarytasy G2E (dusk, ciemna ściana, drewno) | odmowa | GENERAL / DETAILS | c63c30da | okap ✓, stopa ✓ — dla części 244..716 px | dwuspadowy ✓ (bez skrzydła garażu i szczytów bocznych) | okno główne ✓, wejście (jako okno) ~; brama garażu **nieodczytana** | 1 połaciowe (znak wodny) | 0 / 0 | 1.52 s |
| Marcówki (szczyt frontowy) | odmowa | **odmowa** (domyślnie) | — | — | — | — | — | — | 0.70 s |

Wskaźnik zbiorczy (cel aspiracyjny ≥ 3/4 dotąd nieudanych): **3/4 kontrolnych daje sensowną, zamkniętą bryłę
orientacyjną** (Goździkowce, Cieszynianki, Rarytasy); Marcówki — nazwana odmowa. W trybie opcjonalnym `SILHOUETTE`
Marcówki daje poprawny kształt szczytu frontowego (444703e6), ale tryb nie jest przyjęty (§4).

Słabe punkty uczciwie: bramy i drzwi na wielowykończeniowych elewacjach w trybie GENERAL są często nieodczytywane
(brak wiarygodnego odniesienia jasności ściany); znak wodny wydawcy daje fałszywe okna połaciowe (1 na Cieszyniankach,
1 na Rarytasach); skala jest nadal założona (piętro 2.9 m lub drzwi 2.2 m), więc szerokości różnią się od rzeczywistych.

## 4. BLIND-N2 (4 zdjęcia, nigdy nieoglądane przed biegiem)

| id | źródło | bieg na kodzie zamrożonym 5dc23fa | ocena po obejrzeniu | kod końcowy |
|---|---|---|---|---|
| b1 domki drewniane w lesie | Commons, CC BY-SA 4.0 | SILHOUETTE, model d05ffa1c | **BŁĘDNY** — korony świerków wzięte za dach | odmowa (`no straight eave line…`) |
| b2 dom z gankiem na tle gór | Commons, CC BY-SA 4.0 | odmowa (`corners too narrow`) | dom widoczny; odmowa = brak zasięgu | odmowa |
| b3 czarny blok, płaski dach | Commons, CC BY 3.0 | odmowa (`no house outline`) | poza zakresem (płaski dach, wielorodzinny) — odmowa poprawna | odmowa |
| b4 czarny dom z dachem z darni | Commons, CC BY 2.0 | SILHOUETTE, model 10a65fbb | **BŁĘDNY** — góry i woda wzięte za dach | odmowa |

**Wynik ślepy: 0/4 poprawnych modeli; na kodzie zamrożonym 2/4 modele błędne — oba z trybu SILHOUETTE; tryb GENERAL
na żadnym ślepym zdjęciu nie dał fałszywego modelu.** Decyzja po ślepym teście (nie strojenie progów, tylko wyłączenie
trybu): SILHOUETTE wyłączony z domyślnej ścieżki (`outlineFallback` domyślnie `false`), bo błędna bryła jest gorsza niż
odmowa. Po tej decyzji kod końcowy daje na BLIND-N2 4/4 nazwane odmowy i 0 fałszywych modeli. Ten drugi bieg nie jest już
ślepy w sensie metodologicznym i tak go raportuję. Zdjęcia realne (cienie, drzewa przed domem, góry w tle, drewno bez
pasa okapu) pozostają poza zasięgiem deterministycznego czytnika: `NEW_BLIND_GENERALIZATION_NOT_SHOWN`.

## 5. Pierwszeństwo rzutu dla okien połaciowych (DEC-UNIVERSAL-OPENING-CORE-003)

- `reconstruct-v2.ts`: rzut kondygnacji pod dachem jest czytany zawsze (`mainRoof.kind === 'GABLE'`), niezależnie od
  tego, czy render pokazał plamę okna połaciowego. Render tylko potwierdza (`SOURCE_CORROBORATED`), rzut sam daje
  `SOURCE_DERIVED`.
- Test regresyjny `plan-first-rooflights-005x-n2.test.ts`: syntetyczny dom (rysunki tylko z tego repo), dwa okna połaciowe
  podane **wyłącznie** callout'ami na rzucie poddasza, elewacje bez plam, połać bez koloru → 2 okna `SOURCE_DERIVED` na
  właściwych połaciach i miejscach. Z przywróconą starą bramką test daje 0 (sprawdzone). Rzut bez symboli → 0 okien.
- Prefiltr `readTintedCallouts` (`prefilter`, domyślnie włączony): test uśredniany (min/max w oknie 13×13 na siatce 4 px,
  promienie co 2 px, 16 z 32 promieni) jest **warunkiem koniecznym** pełnego testu pierścienia (dowód w komentarzu
  w kodzie) — nie wprowadza false negatives. Sprawdzone na 4 prawdziwych rzutach poddasza: odczyty identyczne bajt
  w bajt. **Zysk czasu tylko 3–15 %**: 85–90 % czasu to OCR ~600 kandydatów pierścieni, nie ich szukanie.
- Czas: plan czytany teraz także na Goździkowcach, Cieszyniankach i Rarytasach (12–19 pierścieni, 0 okien połaciowych →
  modele bez zmian); pojedynczy replay 25–42 s na desktopie, pięć równolegle 79 s (N1: 38 s). **Android: NOT_READY**
  (tyle samo albo 4–6× dłużej na telefonie — nie do przyjęcia).
- A01: 6/7 okien połaciowych z rzutu (17 pierścieni), 7. nadal UNRESOLVED; głębokość A01 8.008 m bez zmian.

## 6. NON_MANIFOLD w modelu OWNER-a

Zlokalizowane: `ring-wing-1-0-w0` (ściana frontowa małego wykusza po prawej, dach kopertowy-piramida, ściana z
`FOLLOW_ROOF_PLANES` po czterech połaciach), 6 krawędzi nie dzielonych przez dokładnie dwa trójkąty. **Nie** na styku
koperta/wystawka/kosze. Bez okna `photo-opening-4` w tej ścianie ostrzeżenie znika → przyczyną jest wycięcie otworu
w ścianie, której góra idzie po połaciach piramidy (T-złącza w siatce wycięcia). Renderer: `geometry ok`, w widokach
BuildWorld nie widać szczeliny ani z-fightingu w tym miejscu przy domyślnych kamerach. Naprawa należy do jądra geometrii
(cięcie otworu), poza zakresem N2 — nie promuję `VISUAL_VERIFIED`; status OWNER_VISUAL_PENDING.

## 7. Kontrole (replay offline, kod końcowy)

| dom | model | oczekiwany | zmiana |
|---|---|---|---|
| A01 multi-source | 1661d4bf | 1661d4bf | brak (6/7 połaciowych, 3 kominy) |
| Goździkowce | 911456a8 | 911456a8 | brak (garaż, ściana 0.303, brama 3.22 bez zmian) |
| Marcówki | cf797743 | cf797743 | brak |
| Cieszynianki | e4e56292 | e4e56292 | brak |
| Rarytasy DEV G2E | 9f5fd342 | 9f5fd342 | brak |
| Rarytasy OWNER m3ea… | NOT_RUN | — | brak wejścia; m84f nie podstawiony |

## 8. Testy

- nowe: `photo-generalization-005x-n2.test.ts` (9 testów — ciemna ściana o zmierzchu, drewno bez fałszywych otworów,
  szara ściana w cieniu, szczyt frontowy: domyślnie odmowa / na życzenie SILHOUETTE z kalenicą w głąb, determinizm,
  `DETAILS_SUPPORTED` tylko z otworami, odmowa obrazu bez domu, odmowa obrazu bez nieba), `plan-first-rooflights-005x-n2.test.ts` (3).
- zmienione pakiety (reconstruction, source-metrics, synthetic-drawings, tests/architecture, apps/web/src): **1502/1503**; jedyna porażka to bramka rozmiaru śledzonego APK (KNOWN_BASELINE_FAIL); tsc czysty; 5 replayów jak wyżej.
- BuildWorld UI smoke (`Photo…`, przeglądarkowy dekoder JPEG): Goździkowce 1 otwór + 2 połaciowe (GENERAL), 2.5 s;
  Cieszynianki 7 otworów (CLI: 7) ; Rarytasy 3 otwory (CLI: 2 — różnica dekodera JPEG przeglądarki vs CLI, znana z N1);
  Marcówki — nazwana odmowa; 0 błędów strony.
- audyt domknięcia: wszystkie modele 0 błędów; jedyne ostrzeżenie — §6.
- APK size gate: `KNOWN_BASELINE_FAIL` (śledzone stare APK 39 556 682 B > 32 MB) — bez zmian, nieusuwane.

## 9. Odrzucone iteracje (skrót; pełna lista w ledgerze)

kolor dachu z modu na surowych pikselach (dachówki dwumodalne); bieg dachu z przerwą stałą (znak wodny przerywa);
„rywal” = kolor ściany (cień pod okapem zjadał pokrycie); szerokie okno odniesienia jasności (4–6 s, bez zysku);
tylko globalny model koloru (dach oświetlony nierówno) i tylko lokalny (gubi dolną część połaci); „pierwsza” zamiast
„najniższej” krawędzi; roślinność bez kwiatów w całym trybie GENERAL (Goździkowce traciły okap); tryb SILHOUETTE
domyślnie (2/2 błędne na ślepym zestawie).

## 10. Werdykty

- `PHOTO_GENERALIZATION_PARTIAL_DEV_ONLY` — 3/4 obrazów rozwojowych z bryłą (z 0/4), 0 fałszywych modeli na ślepym
  zestawie w trybach domyślnych; uogólnienie na nowe zdjęcia **nie wykazane** (BLIND 0/4 poprawnych). Nie „uniwersalne”.
- `PLAN_FIRST_ROOFLIGHTS_FIXED` — rzut czytany niezależnie od renderu, test regresyjny; wydajność **NOT_READY dla Androida**.
- `WEB_APP_PHOTO_ENTRY_UPDATED` — `Photo…` w BuildWorld web pokazuje tryb i poziom; ta sama ścieżka co CLI.
- `ANDROID_ENGINE_ONLY` — brak wejścia w aplikacji Android; nic nie promowane do Androida.
- `OWNER_VISUAL_PENDING` — brak akceptacji wizualnej OWNER-a; NON_MANIFOLD w wykuszu zlokalizowany, nienaprawiony.
- Brak `ALL_PASSED` / `ALL_GREEN`.

## 11. Propozycja na dalej (bez uruchamiania)

Deterministyczny czytnik dochodzi do granicy na prawdziwych fotografiach (drzewa i góry za domem, brak kontrastu
okapu). Realna ścieżka: mały model segmentacji fasada/dach/niebo/roślinność (np. klasa SegFormer-B0 / MobileSAM,
licencje do sprawdzenia, działanie offline w przeglądarce przez ONNX Runtime Web / WASM, ok. 4–15 MB), którego wynik
zastępuje maski koloru w trybie GENERAL; obraz pozostaje na urządzeniu użytkownika (bez wysyłki), a koszt to rozmiar
pakietu i 0.5–2 s na telefonie. Nie uruchamiano, nie zakładano — tylko propozycja.

## 12. Źródła i prywatność

W repozytorium nie ma żadnych pikseli zdjęć, wizualizacji ani rzutów. Obrazy: prywatne zdjęcie OWNER-a i A01 (bez
zmian), cztery wizualizacje kontrolne (istniejące legalne cache), cztery zdjęcia Commons (licencje CC, autorzy
w `blind-manifest.md`) — wszystkie poza repo. Rendery i zrzuty UI zawierają wyłącznie widok modelu BuildWorld.

## 13. Artefakt renderów

`005x-n2-renders.zip` (poza repo, załączony do rozmowy), SHA-256 `f475fc0534a242593c3ff267865c8168068ad403fc0cc93fed048b8180f76421`; w środku `SHA256SUMS.txt` każdego pliku,
`CZYTAJ.md` z tabelą przed/po, rendery BuildWorld (¾, przód, lewa, góra) i zrzuty przycisku `Photo…`. Odmowy są w tabeli,
bez obrazka.
