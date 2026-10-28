# STAGE BUILDPLAN N8-02A / FIX-05B — skala i rejestracja poddasza: Trytomach i Arganiach

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `cdfeb44` (N8-01) |
| solver | `SOLVER_V2_VERSION` **2.10.0 → 2.11.0** |
| APK | nie budowany |
| projekty | Dom w trytomach (G), ARCHON `m6802645623649`, https://www.archon.pl/projekty-domow/projekt-dom-w-trytomach-g-m6802645623649 · Dom w arganiach (G2E), ARCHON `m32b290f26a4e8`, https://www.archon.pl/projekty-domow/projekt-dom-w-arganiach-g2e-m32b290f26a4e8 |
| ZIP | `BuildPlan-N8-02A-Attic-Scale-Before-After.zip`, 17 183 877 B, SHA-256 `8163dd97939558eae1567d1a9d0e2d7daa83478c39079a5220ffca3fa9790536`, 135 plików; przekazany bezpośrednio, poza Git (zawiera obrazy ARCHON w `SOURCE-REFERENCE/`) |

## Sprostowanie N8-01

Raport N8-01 podawał, że rzut poddasza Trytomach ma własną skalę 0,0297 m/px i jest źle rejestrowany w skali parteru.
**To było błędne.**

- Arkusz poddasza ma skalę parteru (≈ 0,0213 m/px). Obrys ścian zewnętrznych ma 632 px na obu arkuszach (111..743
  i 108..740 px).
- 0,0297 pochodzi z 5 kotwic łańcuchów o poprawnych wartościach, ale ze złymi rozpiętościami w pikselach.
  Pomieszczenie 3, podpisane 398, ma około 190 px, a nie 134,5 px.
- Błędem był **zasięg** rzutu poddasza, ucięty do części opisanej łańcuchami (x ≤ 502 px).

## FIRST_BAD

- **Trytomach.** Łańcuchy opisują detal poddasza, a zasięg brał tylko ściany przy tym detalu. Przez to:
  - rama v2 nie znalazła lic („no outer faces found”);
  - poddasze stanęło na 7,24 z 12,99 m, a szczyt pod dachem został otwarty;
  - pojawiło się `STOREY_COVERAGE_DISAGREES`.
- **Arganiach.**
  - Skala arkusza poddasza 0,0090 m/px pochodzi z **2 kotwic** (0,71 m / 79 px, 0,42 m / 47 px, pewność 0,66).
    Rysunek temu przeczy: pomieszczenie 7, podpisane 474, ma około 172 px, czyli 0,0275 m/px, wobec 0,0269 na parterze.
  - Layout przyjął tę skalę jako „drukowaną przez oba rzuty” (k = 0,333, poddasze na 1 % budynku), a v2 wziął
    0,0090. Wynik: `NO_MASS_REACHES_UP`.
  - Po naprawie zasięgu i odrzuceniu tej skali przez ściany wygrywało dopasowanie WALL_PAIRS k = 0,684. Kładło ono
    pomniejszone poddasze na ściany wewnętrzne parteru i kończyło się remisem `STOREY_COVERAGE_DISAGREES`.

Tabele, kotwice, transformacje i pomiary: `FIRST_BAD.md` w ZIP-ie oraz `stage-reports/artifacts/analyzer-n8-02a/`.

## Zmiany (reguły ogólne)

| plik | zmiana |
|---|---|
| `plan-decomposition.ts` | `wallsJoinedTo` (nowa, eksport do testów). Gdy łańcuchy opisują detal, zasięg obejmuje ściany połączone z ramą narożnikiem, trójnikiem albo jako ściana szczytowa przerwana otworami (dwie ściany zbioru kończą się na jej osi, ≥ 4 ściany od siebie). Pasmo wybiegające o więcej niż ścianę poza ściany poprzeczne na obu końcach to okap, nie ściana. Ziarno to tylko pasma, których bieg sięga prostokąta łańcuchów, oraz pasmo wpuszczone marginesem samą osią, na którym w obrębie ściany kończy się ściana ramy. Inne pasmo wpuszczone samą osią nie wnosi nic, więc wolnostojący garaż z 005N §21.22 nadal nie jest dołączany. |
| `plan-decomposition.ts` | `cornerJoined` (005N): ściana szczytowa zamykająca prostokąt dwóch ścian **ramy**, które obie kończą się na jej osi. |
| `layout.ts` | `alignPlans`: placement kładący ramę ścian zewnętrznych rzutu (`outerWallAxes`) na lica jednej bryły poniżej, na czterech bokach w paśmie ściany, wygrywa z dopasowaniem, które tego nie robi, chyba że tamto dzieli ≥ 2× więcej ściany (`STATED_HOLDS_SHARE`, ta sama stała co dla skali wydrukowanej). Wynik niesie `outline: { over, coincident }`. |
| `layout.ts` | `inferStructuralLayout`: przy takim wyborze rywalami w teście remisu są tylko placementy, które też kładą ramę na bryle. To ta sama konstrukcja co przy skali wydrukowanej. |
| `v2/reconstruct-v2.ts` | wersja 2.11.0 z opisem. |

- Bez nazw domów, bez współrzędnych, bez progów dopasowanych do domu.
- Skala z 2 kotwic nie jest mnożona: ściany jej przeczą, więc przestaje rozstrzygać.
- `WALLS_OVERLAP` i inne walidatory bez zmian. Renderer bez zmian.

## Wynik

| | Trytomach przed | Trytomach po | Arganiach przed | Arganiach po |
|---|---|---|---|---|
| `model.json` | `d2bf0c031d47…` | `ce64cc099c83…` | `34a95a766d16…` | `cf9b660ca4f3…` |
| skala v2 poddasza | 0,021347 („no outer faces”) | 0,021347 (lica, 0,0 % / 0,3 %) | 0,008967 | 0,026792 (lica, osie 0,7 %) |
| poddasze | 0..7,24 × 7,25 m | 12,99 × 7,25 m | brak | 14,20 × 8,62 m (bryła główna), garaż parterowy |
| bramka | `STOREY_COVERAGE_DISAGREES`, `ROOF_EVIDENCE_DISAGREES` | `ROOF_EVIDENCE_DISAGREES` | `NO_MASS_REACHES_UP`, `ROOF_EVIDENCE_DISAGREES` | `ROOF_EVIDENCE_DISAGREES` |
| kompletność | COMPLETE_WITH_OPEN_QUESTIONS | COMPLETE_WITH_OPEN_QUESTIONS | COMPLETE_WITH_OPEN_QUESTIONS | COMPLETE_WITH_OPEN_QUESTIONS |
| kompilator BuildWorld | geometry ok | geometry ok | geometry ok | geometry ok |
| okna / drzwi / kominy | 10 / 8 / 0 | 11 / 9 / 1 | 6 / 10 / 0 | 9 / 13 / 2 |
| pomieszczenia (parter + poddasze) | 3 + 5 | 3 + 5 | 4 + 0 | 4 + 4 |

Przegląd wzrokowy (`BOARDS/*-ARCHON-vs-BEFORE-AFTER.png`, 9 kamer jak w 1311). To przegląd, nie pomiar.

- **Trytomach:** oba szczyty są zamknięte pod dachem, ściany poddasza biegną na całą długość, okna szczytowe stoją
  w ścianach.
- **Arganiach:** poddasze stoi na bryle głównej, na szczytach są okna poddasza, garaż jest parterowy z płaskim dachem
  jak na ARCHON.
- W obu domach żadna ściana nie zniknęła. Kompilator nie zgłasza błędów otworów.

Gorsze albo niepewne (bez naprawy):

- **Arganiach:**
  - pustka nad salonem nie jest wycięta w stropie (jest tylko otwór schodów 0,97 × 1,34 m);
  - pomieszczenia poddasza scalone: 4 zamiast 8;
  - pas okien w miejscu bramy garażowej (bez zmian);
  - wysokość płaskiego dachu garażu jest przyjęta (`ASSUMED`, wysokość kondygnacji) i zmieniła się z 3,57 na
    2,80 m;
  - szczyty: 2 okna i 1 okno, a ARCHON pokazuje drzwi balkonowe.
- **Trytomach:**
  - pomieszczenia poddasza scalone: 5 zamiast 9;
  - drugie okno szczytu wschodniego ma 0,30 m wysokości.
- **Oba domy:** `ROOF_EVIDENCE_DISAGREES` bez zmian.

## Regresja ośmiu domów (offline, `second-house.ts`, zapieczętowane wejścia)

| dom | wynik |
|---|---|
| A01, Goździkowce, Marcówki, Cieszynianka, Rarytasy | `model.json` identyczny z N8-01 |
| **Sasanki** | identyczny (`c007ce8bab16…`): dach z N8-01 bez zmian |
| Trytomach, Arganiach | zmiana zamierzona |

Pierwsza wersja ziarna (wszystkie pasma marginesu) dołączała wolnostojący garaż w teście 005N §21.22. Zawężenie
ziarna to usunęło bez zmiany wyniku obu domów. Szczegóły: `stage-reports/artifacts/analyzer-n8-02a/regression-8-houses.json`.

## Testy (celowane; pełnego CI nie uruchamiano)

| test | wynik |
|---|---|
| `packages/reconstruction` (cały pakiet, 2.11.0) | 92 pliki, **1112/1112** |
| `attic-registration-n8-02a.test.ts` (nowy) | **8/8** |
| `analysis-service`: garages-n7-fix03, partial-preview-n7-p1, service, setback-n7-fix04, thin-body-n7-p2r, wall-recovery-n7-fix01, wall-thickness-n7-fix02 | **72/72** |
| `tsc --noEmit` (root) | czysto |

Nowy test `attic-registration-n8-02a.test.ts` sprawdza:

- ściany łączone narożnikiem i trójnikiem, ze ścianą szczytową przerwaną otworami;
- odrzucenie obrysu okapu i odrzucenie rysunku odłączonego;
- arkusz poddasza w innej skali obrazu (2,5 cm/px);
- kondygnację przesuniętą na arkuszu;
- skalę z 2 kotwic, trzy razy za małą;
- dopasowanie pomniejszonego rzutu na ściany wewnętrzne poniżej (bez nowej reguły wybiera k = 0,79 z konfliktem,
  z regułą k = 1 bez konfliktu);
- poddasze mniejsze od parteru, które zostaje mniejsze (12 × 9 m na bryle 12 × 17 m).

Rendery: `apps/web/tools/review-shots.ts --model-files`, 9 kamer, ΔY ortho −540. Zrzuty „przed” są bajt w bajt
identyczne z zestawem ARCHON 1311.

## Następny krok

Do decyzji OWNER-a po ocenie ZIP-u. Do wyboru: pustka nad salonem w stropie poddasza, podział pomieszczeń poddasza
albo brama garażowa Arganiach. N8-02B nie był zaczynany.
