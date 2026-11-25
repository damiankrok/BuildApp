# v3.54.20 — protokół (zapisany 2026-11-24/25, przed zamrożeniem kodu i przed losowaniem nowej próby)

## 1. Baseline i zbiory

- **Baseline** = kod APK 1352 (`af7db0e`, v3.54.19 zamrożenie 2) uruchomiony na tych samych bajtach źródeł.
- **DEV** = wszystkie 20 domów v3.54.19 (9 znanych + NEW-D + NEW-E + NEW-F). Są obejrzane; wolno na nich stroić; nie są
  dowodem transferu. Porównanie kodu na DEV odbywa się **przy tych samych odczytach**: szkice elewacji, odczyt metryczny
  i (gdzie rewizja modelu się nie zmienia) recenzja odtwarzane z nagrań; na żywo czytane jest tylko to, czego nagrania
  nie zawierają (odczyt struktury `form-read/2`, listy otworów elewacji dla nowych przerw rzutu).
- **NEW-G** (nowa próba odłożona): losowana **po zamrożeniu kodu** tym samym `v35419/trial/select.py`, commit bazowy
  `9ac25b6…`, etykieta ziarna `V35420-NEWG`, jeden przyjęty dom na pulę (Studio Atrium, Lipińscy, Dobre Domy, ARCHON
  `archon-pool-2.txt`); rodziny otwarte dotąd (w tym cztery z NEW-F) dopisane do `seen-families.txt` przed losowaniem.
  Co najmniej dwóch wydawców; gdy pula nie da domu w 14 otwarciach, brak jest zapisany. Do zamrożenia pobierany jest
  tylko pakiet. Baseline i kod zamrożony po **jednym** biegu na tych samych bajtach; cechy referencyjne spisane ze
  źródeł przed otwarciem modeli; **nic nie jest strojone po wyniku NEW-G**.

## 2. Co jest rozliczane osobno (kryteria nie zmieniają się po ocenie)

1. **Zewnętrze** — „użyteczna miniatura", reguła z `v35418/PROTOCOL.md` §3 bez zmian; ocena ślepa (X/Y).
2. **Wnętrze** — nakładka ścian parteru na rzut, reguła z `v35419/PROTOCOL.md` §3 bez zmian; ocena ślepa (X/Y).
3. **Forma (fakty, bez oceniającego)** — z oddanego modelu, wobec cech F spisanych ze źródeł: liczba brył pod własnym
   dachem, rodzaj dachu bryły głównej, kierunek kalenicy, liczba pełnych kondygnacji (ściany ≥ 4,4 m = dwie). Każda
   z czterech cech: zgodna / niezgodna / źródło nie rozstrzyga. Ta tabela nie zależy od recenzji ani od wykończeń.
4. **Zastosowanie danych** — z `STRUCTURE_READBACK` i `OPENINGS_READBACK` oddanego modelu: ile przyjętych własności
   struktury jest w modelu; ile otworów zewnętrznych stoi tak, jak je związał wykonawca (różnica ≤ 5 mm), ile ma błąd
   sumy odcinków ściany, ile wychodzi poza ścianę. To mierzy drogę wartość → element, nie poprawność wartości.
5. **Utracone poprawne cechy** — dla każdego domu: cechy referencyjne OK w baseline i nie-OK w kodzie końcowym (z oceny
   ślepej) oraz liczby z modeli: ściany wewnętrzne, otwory zewnętrzne, okna połaciowe, kominy mniej niż w baseline.
6. **Cały wynik** = zewnętrze użyteczne ORAZ wnętrze zgodne z rzutem (jak w v3.54.19).

**Zmienność recenzji.** Różnica, która jest tylko wykończeniem albo kolorem (jak wejście Domu pod pomarańczą w v3.54.19),
nie jest liczona jako zysk kodu: w tabeli formy (3) i w liczbach modeli (5) jej nie ma, a w ocenie ślepej jest
oznaczana, gdy geometria obu wariantów jest ta sama (te same bryły, dachy i otwory co do 5 cm).

## 3. Oczekiwanie zapisane z góry (NEW-G)

Na NEW-G (3–4 domy): (a) liczba domów z **formą zgodną w czterech cechach** rośnie względem baseline albo jest już pełna
w baseline; (b) zewnętrze użyteczne nie spada na żadnym domu i rośnie co najmniej o 1, jeżeli baseline ma co najmniej
jeden dom nieużyteczny z powodu formy; (c) wnętrze zgodne nie spada na żadnym domu; (d) przyjęte własności struktury są
w modelu w ≥ 90 %. Niespełnienie któregokolwiek punktu jest raportowane wprost jako niespełnione.

## 4. Budżet

Księga `research/ai-assist/spend-ledger-v35417r3.json`, bez nowej puli: 49,679019 z 68,542857 USD na początku etapu.
Plan etapu: do 9 USD (odczyty struktury i listy otworów na DEV ≈ 2; NEW-G baseline + końcowy ≈ 2,5; host ≈ 1,5; rezerwa
na diagnozę ≈ 3). Koszt odczytu struktury: 0,02–0,06 USD na dom.

## 5. Zamrożenie (zapisane przed losowaniem NEW-G, 2026-11-25)

- **Kod zamrożony = `024e2b7`** (kod analizy; późniejsze commity do końca etapu zmieniają tylko dokumenty, rejestr scen
  i narzędzia dostawy — gdyby było inaczej, ten zapis by o tym mówił).
- Rodziny NEW-F dopisane do `v35419/trial/seen-families.txt` przed losowaniem.
- Stan DEV w chwili zamrożenia (te same nagrania co APK 1352): forma zmieniona w Medulinie, Mindelo (bryła ze źródeł
  zamiast LOCAL z płaskimi przybudówkami), Skagen (dwie kondygnacje, garaż), Fabii (dach kopertowy), Amarylisie
  (wysokości ścian, strony elewacji), Willi Elizie (dachy czterospadowe, dwie kondygnacje bryły głównej); znane ubytki
  liczbowe: G6 5 → 3 otwory (strony dwóch elewacji bocznych zamienione przez odczyt struktury przy równym świadectwie
  rzutu), Medulin i Mindelo mniej otworów i ścian niż bryła LOCAL, którą zastąpiono. Ocena ślepa rozstrzygnie, czy to
  straty cech.

## 6. Ramiona NEW-G (zapisane przed losowaniem i przed jakimkolwiek biegiem)

- **B** — baseline `af7db0e`, jeden bieg na żywo. **F** — kod zamrożony `024e2b7`, jeden bieg na żywo na tych samych
  bajtach. Porównanie B ↔ F jest wynikiem głównym (§3) i jest oddane takie, jakie wyszło za pierwszym razem.
- **F@B** (pomocnicze, bez wpływu na wynik główny) — kod zamrożony odtworzony na nagranych odczytach biegu B (te same
  szkice elewacji i ten sam odczyt metryczny; na żywo tylko to, czego B nie pytał: odczyt struktury, nowe listy otworów,
  recenzja zmienionej rewizji). Służy wyłącznie do rozdzielenia wpływu kodu od zmienności świeżych szkiców: różnica
  F ↔ F@B jest zmiennością odczytów, różnica B ↔ F@B jest kodem. Tabela formy (§2.3) i liczby modeli (§2.5) podawane
  dla wszystkich trzech ramion.
