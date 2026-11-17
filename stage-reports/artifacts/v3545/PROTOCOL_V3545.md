# v3.54.5 — protokół próby potwierdzającej (zamrożony przed pierwszym przebiegiem)

Data: 2026-11-17. Gałąź `claude/new-session-3kzcgh`. Ten plik, pieczęć `PROTOCOL.seal` i skróty `research/source-to-model/v3545/refs.sha256`
są zatwierdzone w jednym commicie, zanim którykolwiek z ośmiu domów przeszedł przez LOCAL, bazową ścieżkę H albo nową ścieżkę H.
Po otwarciu pierwszego wyniku nic z tego nie jest zmieniane; poprawki po nim są późniejszym DEV i tak są nazywane.

## 1. Rewizje — trzy różne, nie jedna

| co | rewizja |
|---|---|
| zamrożony kandydat v3.54.4 (dał wynik 5/8 i 1/8) — **bazowa ścieżka H tej próby** | `3c531aee…` |
| dostawa v3.54.4 z późniejszym zbiorczym dopytaniem o elewacje (próba na 3 domach, niepotwierdzona) | `9c65b81` |
| build hosta użyty w E2E v3.54.4 | zbudowany przed dwiema ostatnimi zmianami przeglądu i przed dopytaniem; nie jest dowodem dla tej dostawy |
| **kandydat v3.54.5** (kod, prompt, schemat narzędzi, limity) | commit z tym plikiem — w `PROTOCOL.seal` |

## 2. Próba

8 nowych rodzin: `stage-reports/artifacts/v3545/confirm8.txt`; wybór i odrzuceni kandydaci: `SELECTION.md` (wybór po źródłach, w kolejności
list wydawców, bez uruchamiania analizatora). 6 wydawców (archon.pl 2, extradom.pl 2, dobredomy.pl, lipinscy.pl, studioatrium.pl,
architecturaldesigns.com), 6 domów spoza ARCHON. Kwoty: niepełne źródła 4 (brak przekroju), asymetria 4, skrzydło/garaż wysunięty 3,
otwory na dwóch poziomach 2, jednostki ft/in 1. Żadna rodzina z listy wykluczonych (wszystkie wcześniejsze kampanie, w tym 8 domów
potwierdzenia v3.54.4, które są teraz DEV). Zastrzeżenie: oba domy ARCHON mają inne warianty tej samej rodziny wśród adresów
widzianych wcześniej na listach wydawcy (nieanalizowanych).

## 3. Referencje

`research/source-to-model/v3545/refs-detail-confirm/*.json` (format `REFERENCE_FORMAT.md` 1.1): per strona — końce ścian, wiersz ±0,00,
długość boku z wymiarów rzutu, każdy otwór jako prostokąt w pikselach opublikowanego obrazu z poziomem, typem i niepewnością.
Odczytane przez dwóch czytelników źródeł (osobne sesje agenta, inny model niż czytnik kandydata, inna procedura: powiększone wycinki
z siatką pikseli), którzy nie widzieli żadnego wyniku analizatora, modelu ani odpowiedzi API. **Ograniczenie:** to nie jest odczyt
człowieka; niezależność polega na innym modelu, innej procedurze i braku dostępu do wyników. `refs-confirm/*.json` to te same fakty
przeliczone mechanicznie (`to-v3544-ref.py`) do formatu historycznego oceniacza v3.54.4.

## 4. Co jest uruchamiane, raz

1. **LOCAL** — `packages/analysis-service/scripts/second-house.ts --package … --cache … --recogniser` (bez API).
2. **BAZA H** — kod `3c531aee…` w osobnym worktree, jego własny skrypt `research/source-to-model/v3544/house-run.ts`, na żywo.
3. **NOWY H** — ten commit, `research/source-to-model/v3545/house-run.ts`, na żywo (pełny odczyt nowym czytnikiem).
4. **REPLAY** — odpowiedzi z (2) przez konsumenta tego commitu, bez wysyłania czegokolwiek: wpływ samego konsumenta.
Model czytnika: `claude-sonnet-5-5` (2 / 10 USD za MTok). Limity: INVENTORY 1, PLAN 1, FACADES 1 + celowane dopytania najwyżej 4
(+1 ponowienie nieparsowalnej odpowiedzi), REVIEW najwyżej 2 rundy po 12 korekt. Pierwszy wynik każdego przebiegu jest zachowany.
Wspólne odpowiedzi służą wnioskowi o konsumencie; pełny bieg na żywo — wnioskowi o nowym czytaniu. Różnica dwóch biegów na żywo może
być wariancją odczytu.

## 5. Pomiar

- **Oceniacz szczegółowy** `score-detail.py` (`v3545-detail/1`, tolerancje w pliku, samokontrola `score-detail-selfcheck.py` 10/10):
  mierzy skompilowaną scenę (`measureScene`: obrys ścian, wierzch dachu, każda dziura w ścianie zewnętrznej ze stroną). Otwór jest
  porównywany wyłącznie z otworem referencji tej samej strony i tej samej kondygnacji; scena nie jest obracana, odbijana ani
  skalowana. Tolerancje: położenie (środek wzdłuż boku, środek w pionie, dolna krawędź) max(0,30 m, 2 × niepewność referencji);
  rozmiar max(0,25 m, 15 %, 2 × niepewność); obrys max(0,35 m, 4 %); kalenica 0,45 m. Otwory dachowe nie są tu mierzone.
- **Oceniacz historyczny** `v3544/score.ts` (sześć grup) — obok, bez zmian, do grup DACH, GARAŻ, LUKARNY.
- Cecha bez podstawy w źródle = NOT_ASSESSABLE (n/o), nigdy zaliczenie.

## 6. Kryteria (ustalone przed wynikiem)

Porównywany jest **dom, który oddaje nowa ścieżka** (po decyzji LOCAL/H) z **domem, który oddaje bazowa ścieżka**; obok podane jest
porównanie samych opisów H. Reguła w `compare.py`:
- zysk: cecha binarna (OBRYS, WYSOKOŚĆ, DACH, GARAŻ, LUKARNY) z NIE na TAK; stron zbudowanych +1 lub więcej; otworów poprawnych +2 lub więcej;
- strata: cecha binarna z TAK na NIE; stron zbudowanych −1; otworów poprawnych −2; fałszywych otworów +2;
- **POPRAWIONY** = co najmniej jeden zysk i żadnej straty; **REGRESJA KRYTYCZNA** = OBRYS, WYSOKOŚĆ, DACH lub GARAŻ z TAK na NIE.

**Kryterium kampanii:** POPRAWIONY na co najmniej 3 z 8 domów, u co najmniej 2 wydawców, w tym jednego spoza ARCHON, bez nowej
regresji krytycznej. Osobno raportowane (nie są progiem): ile domów spełnia wszystkie kryteria szczegółowe (OBRYS i WYSOKOŚĆ nie NIE,
wszystkie opublikowane strony zbudowane, poprawnych otworów co najmniej 80 % referencji, fałszywych najwyżej 1, DACH/GARAŻ/LUKARNY
nie NIE); kompletność elewacji (każda opublikowana strona rozliczona w rejestrze jako odczytana albo nazwanie ograniczona —
pominięcie wysłanej czytelnej elewacji jest błędem czytnika, brak źródła nim nie jest); rozkłady błędów otworów.
Brak sukcesu = wynik ograniczony za flagą; progi nie są zmieniane po wyniku.

## 7. Budżet

Księga przed próbą: 16,0845 USD (kampania v3.54.5 dotąd 1,631 USD: DEV na żywo i sondy schematu). Pułap 24,11036 USD narastająco.
Próba: do 4,6 USD (pułap przebiegu 20,70 USD); reszta na finalny host.
