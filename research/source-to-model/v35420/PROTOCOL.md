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

## 7. Zamrożenie 2 — po końcowym przebiegu DEV, nie po wyniku NEW-G (2026-11-25)

**Co się stało.** Zamrożenie 1 (`024e2b7`) zawierało dwie zmiany wprowadzone po ostatnim pełnym przebiegu DEV (`d2`,
kod `ce332dc`) i sprawdzone tylko na pojedynczych domach: (1) reguła kondygnacji ograniczona do bryły głównej i skrzydeł
z odczytu (`c02626a`, dla Willi Elizy), (2) elewacje ustawione stroną z odczytu struktury zdejmowane z rejestracji po
pomiarze wysokości (`024e2b7`, dla G6). Końcowy przebieg DEV na `024e2b7` (`d3`, te same nagrane odczyty) pokazał wobec
`d2` utratę otworów zewnętrznych w czterech domach: Amarylis 10 → 6 (i ściany brył bocznych 6,3–6,9 m pod dachami 7–8°),
Ametyst New 9 → 4, Aletta New 14 → 11, Fabia 11 → 8. To mój błąd procesu: zamrożenie bez pełnego przebiegu.

**Poprawka (`10ce107`)** — wyłącznie na dowodzie DEV: (1) elewacje ustawione stroną z odczytu zostają zarejestrowane
także dla otworów (zachowanie `d2`); (2) pod jednokondygnacyjną bryłą główną żadna inna bryła nie ma ścian wyższych niż
jedna kondygnacja, chyba że odczyt zgłasza część dwukondygnacyjną (bryły 1.10.0; obok bryły dwukondygnacyjnej skrzydło
zostaje takie, jak rysują je jego elewacje — przypadek Elizy). Test kontrolny z kontrpróbami w `structure-v35420.test.ts`.

**Co wiedziałem o NEW-G w chwili poprawki.** Biegi B i F (zamrożenie 1) były zakończone. Znałem liczby z modeli
(bryły, dach, kalenica, wierzch ścian, liczby ścian i otworów — tabela formy §2.3) i zapis szkieletu rzutu Rockville.
**Nie otworzyłem żadnego renderu, sceny ani nakładki NEW-G.** Poprawka nie korzysta z żadnej obserwacji NEW-G; nie
zmienia też niczego, co różniło B od F w tych liczbach.

**Jak to jest rozliczane.**
- Wynik pierwszy NEW-G = B ↔ F na zamrożeniu 1: zachowany w całości (modele, liczby, tabela formy) i raportowany jako
  pierwszy wynik odłożony.
- Kod oddawany (APK) = **zamrożenie 2 = `10ce107`**. Na NEW-G jest odtwarzany **na nagranych odczytach biegu F** (te
  same szkice, ten sam odczyt metryczny, ten sam odczyt struktury; 0 USD poza nowymi listami) — ramię **F2**. Różnica
  F ↔ F2 jest wyłącznie skutkiem poprawki. Ocena ślepa ogląda B i F2, bo recenzja ma oglądać rewizję rzeczywiście
  oddaną; liczby F są podane obok. F2 nie jest wynikiem „pierwszego spojrzenia" i raport tak go nie nazywa.
- Ramię pomocnicze F2@B (kod oddawany na odczytach biegu B) zastępuje F@B w rozdzieleniu wpływu kodu od odczytów;
  F@B (zamrożenie 1) zostaje w zapisie.
- DEV: wariant końcowy = przebieg `d4` na `10ce107` z połączonych nagrań (`d2` ∪ `d3`), 0 USD poza brakującymi odczytami.
- Po zamrożeniu 2 nic nie jest strojone. Gdyby `d4` pokazał kolejną stratę wobec `d2`, zostaje zapisana, nie naprawiona.

## 8. Zamrożenie 3 — luka wykryta przez bieg hosta, zmiana obojętna dla ocenionych modeli (2026-11-25)

**Co się stało.** Końcowy bieg hosta (budowa z kodu zamrożenia 2) dał dla Skagen — domu DEV — bryłę LOCAL: parterową,
z kalenicą w poprzek, mimo uzgodnionych dwóch kondygnacji i kalenicy wzdłuż frontu. Na hoście świeży odczyt metryczny
pozwolił LOCAL zbudować bryłę (w nagraniach DEV LOCAL jej nie budował), a arbitraż sprawdzał wobec opisu struktury tylko
rodzaje dachów — odpowiedział AGREES i LOCAL został. To dokładnie przypadek „błędna bryła LOCAL", który zlecenie nazywa.

**Poprawka (`108611e`)** — arbitraż 1.5.0, struktura 1.1.0: uzgodnione (stan AGREED) kondygnacje i kierunek kalenicy są
trzymane wobec bryły, mierzonej z modelu (`structureAgainstBody`). Własność przyjęta tylko na słowo odczytu nie jest
trzymana przeciw nikomu. Test kontrolny z kontrpróbami.

**Dlaczego to nie unieważnia oceny.** Sprawdzone dwojako, 0 USD poza brakującymi odczytami:
1. `arbitration-neutral.ts` na 28 nagranych biegach kodu oddawanego (20 DEV, 4 NEW-G F2, 4 F2@B): w żadnym biegu
   nowa reguła nie trzyma niczego przeciw bryle, która stoi; **0 decyzji może się zmienić** (zapis:
   `arbitration-neutral.txt` w dostawie).
2. Odtworzenie pięciu domów na `108611e` z tych samych nagrań — Jeziorko i Pomarańcza (LOCAL stoi), Ametyst New
   (LOCAL zastąpiony; jedyny dom, w którym nowa reguła coś trzyma przeciw LOCAL), Medulin, Dom pod jarząbem (NEW-G):
   **modele identyczne co do bajta** z ocenionymi.

**Dowód działania.** Drugi bieg hosta, budowa z `108611e`, Skagen na żywo: LOCAL zakwestionowany (1 sprzeczność —
struktura), bryła ze źródeł stoi: dwie bryły, ściany bryły głównej do okapu 6,0 m (dwie kondygnacje), dach 30°
z kalenicą wzdłuż frontu, garaż pod własnym dachem, 16 otworów zewnętrznych.

**Kod oddawany (APK 1353, host) = zamrożenie 3 = `108611e`.** Ocenione modele (zamrożenie 2) są jego modelami na tych
samych odczytach w sprawdzonych biegach; dla pozostałych 19 biegów równość wynika z punktu 1, nie z ponownego biegu.
Regresy DEV znalezione przez ocenę ślepą (Ametyst New obrócony, Amarylis bez szczytu frontowego i inne — raport §7)
**nie zostały naprawione**: zgodnie z §7 po zamrożeniu 2 nic nie jest strojone pod wynik oceny.
