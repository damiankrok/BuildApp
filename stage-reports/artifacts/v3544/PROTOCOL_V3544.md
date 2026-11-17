# Protokół potwierdzenia v3.54.4 (zamrożony przed pierwszym uruchomieniem)

Dokument opisuje, co jest zamrożone, zanim którykolwiek z ośmiu nowych domów zostanie przetworzony. Pieczęć
(`PROTOCOL.seal`) zawiera skrót commita i skróty plików wymienionych niżej. Po zapieczętowaniu kod, prompt, schemat,
model, limity, kryteria i oceniacz nie są zmieniane do zapisania pierwszego wyniku. Pierwszy wynik zostaje, jaki jest.

## 1. Zbiór

- 8 nowych rodzin domów, niewystępujących w żadnej wcześniejszej kampanii (wykluczenia: wszystkie pakiety w
  `research/source-to-model/v3541|v3542|v3543/sources` oraz ich warianty).
- Wymóg: ≥ 4 wydawców, ≥ 5 domów spoza ARCHON.
- Wybór, pozyskanie pakietów źródeł i referencje wykonał osobny agent, który nie uruchamiał analizatora, nie widział
  żadnego wyniku tej kampanii i nie używał płatnego API. Lista: `stage-reports/artifacts/v3544/confirm8.txt`
  (ścieżki lokalne) i `research/source-to-model/v3544/sources/c4-*.source-package.json`.
- Referencje (tylko tekst i liczby, czytane wyłącznie z rysunków wydawcy i faktów strony):
  `research/source-to-model/v3544/refs-confirm/*.json`, pieczęć `refs-confirm.sha256`. Referencje nie są wysyłane do
  API i nie są czytane przez żaden kod wykonawczy; czyta je tylko oceniacz.

## 2. Procedura (jedno uruchomienie)

1. LOCAL (A1): `packages/analysis-service/scripts/second-house.ts --recogniser`, offline z zapisanych bajtów, solver 2.45.0.
2. H: `research/source-to-model/v3544/house-run.ts --phase confirm` — INVENTORY → PLAN → FACADES → budowa → REVIEW
   (≤ 2 rundy, ≤ 12 korekt na rundę, każda przyjmowana lub odrzucana osobno) → decyzja względem LOCAL (`arbitrate`).
   Model `claude-sonnet-5-5`; limity wyjścia 3000 / 6000 / 12000 / 8000 tokenów; jedno ponowienie transportu.
   Pierwszej interpretacji źródeł nie pokazuje się wyniku LOCAL ani referencji.
3. Oceniacz: `research/source-to-model/v3544/score.ts` — raz, na wyniku z punktów 1–2.
4. Budżet: do 6 USD z puli (pułap księgi 24,11036 USD narastająco). Gdy rezerwacja zostanie odrzucona, dom ma
   status NOT_SENT i jest liczony jako niepoprawiony.

## 3. Kryteria (z `score.ts`, stałe `SCORE`)

Sześć grup; grupa bez odniesienia w referencji = NA (nie jest zaliczeniem):

| grupa | zaliczenie |
|---|---|
| METRIC | szerokość i głębokość ścian zewnętrznych w granicach max(0,35 m; 4 %) referencji |
| HEIGHT | szczyt dachu nad terenem w granicach 0,60 m opublikowanej wysokości (albo kalenica w granicach 0,50 m) |
| ROOF | forma dachu bryły głównej i kierunek kalenicy |
| GARAGE | brama garażowa po stronie z referencji, pokrycie położenia ≥ 50 % (albo brak bramy, gdy garażu nie ma) |
| OPENINGS | liczby otworów na kondygnację po stronach z opublikowaną elewacją: suma różnic ≤ max(2; 25 %) |
| DORMERS | liczba lukarn |

- **Wierne zewnętrze**: wszystkie stosowalne grupy zaliczone.
- **Poprawiony dom**: model przyjęty zalicza więcej grup niż LOCAL i żadna z grup METRIC, HEIGHT, ROOF, GARAGE
  zaliczonych przez LOCAL nie jest niezaliczona. Dom, dla którego LOCAL nie buduje modelu, ma u LOCAL 0 grup.
- **Regresja krytyczna**: grupa METRIC, HEIGHT, ROOF lub GARAGE zaliczona przez LOCAL i niezaliczona przez model przyjęty.
- Model przyjęty = decyzja `arbitrate` zapisana w `trace.json` (DESCRIBED → model z opisu; LOCAL/NONE → model LOCAL).

## 4. Próg sukcesu (z polecenia OWNER-a)

Poprawione całe zewnętrze na ≥ 3 z 8 domów u ≥ 2 wydawców, w tym u ≥ 1 spoza ARCHON, bez nowych regresji krytycznych.
„Poprawiony dom" i „wierne zewnętrze" raportowane osobno, ze wszystkimi mianownikami.

## 5. Znane ograniczenia oceniacza (zapisane przed wynikiem)

- Liczy otwory i ich strony z modelu; nie mierzy położenia każdego otworu (poza bramą garażową).
- Stronę ściany wyznacza z orientacji i położenia względem środka obrysu; ściana cofnięta liczy się do swojej strony.
- Brama garażowa w modelu LOCAL nie ma oznaczenia użycia: za bramę liczy się drzwi zewnętrzne parteru szerokości
  ≥ 2,2 m bez szklenia. Ta sama reguła stosuje się do obu modeli.
- Lukarny liczy łącznie, bez podziału na strony.
- Nie ocenia wnętrza, materiałów, balkonów, kominów ani ganków.
