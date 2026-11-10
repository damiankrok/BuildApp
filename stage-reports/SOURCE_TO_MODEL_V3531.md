# SOURCE-TO-MODEL v3.53.1 — po checkpoincie S53 (raport punktu kontrolnego)

Doprecyzowanie OWNER-a v3.53.1 (2026-11-10) w aktywnej kampanii v3.53. Gałąź `claude/new-session-3kzcgh`.
Punkt odniesienia: kod `e223cb2`, raport `2d5a9fb`. **Kod tego punktu kontrolnego: `a2e2f45`** (macierz testów biegła
na nim; późniejsze commity zmieniają tylko skrypt badawczy `sdk-live.ts` i dokumenty). Poprzedni raport:
`stage-reports/SOURCE_TO_MODEL_V353.md`. Żadnego płatnego wywołania w tej części; księga bez zmian.

| | stan |
|---|---|
| **SLICE: koszt** | **PASS** — rezerwacja przed żądaniem w sekcji krytycznej, pułap skumulowany, token dostępu; trzy odtworzone błędy koordynatora mają testy, które bez poprawki padają |
| **SLICE: uwagi audytu styków** | **PASS w zakresie** — 50 → 5 uwag na 10 zapisanych opisach, każda klasa z werdyktem; 5 pozostałych nazwanych i nienaprawionych |
| **SLICE: routing** | **PARTIAL** — reguła i kotwice zaimplementowane i zmierzone na zapisanych wynikach oraz na całej ścieżce; efekt kotwic na prawdziwym domu niezmierzony (wymaga płatnego odczytu) |
| **SLICE: podgląd fazy i tożsamość replay** | **PASS po stronie serwisu**; klient Android jeszcze tego nie pokazuje |
| **SLICE: prywatne uruchomienie / SDK** | **BLOCKED na jednej zależności** — klucz API nie może być bezpiecznie przechowany w tej sesji (§6); suchy przebieg prawdziwego adaptera dochodzi do API |
| **CAMPAIGN** | **WORK_IN_PROGRESS** |
| **VERIFICATION** | host: macierz dotkniętych pakietów na `a2e2f45` (§7), 10 zapisanych opisów przebudowanych, 3 pełne ścieżki na zapieczętowanych paczkach. **Płatny odczyt przez SDK: NOT_VERIFIED. Wdrożenie: brak. Android UI: NOT_VERIFIED. APK: nie budowano.** Ocena plansz przez OWNER-a: do odbioru. |
| **NEXT** (jedna czynność) | OWNER uruchamia u siebie jedną komendę z §6 (jeden płatny odczyt DEV przez SDK, ok. 0,10 USD) albo decyduje o hoście pilota; po działającym serwisie — token i `describing` w kliencie Android oraz APK ≥ 1328. |

## 1. Egzekwowanie kosztu (`apps/analyzer-api/src/house-reader-spend.ts`)

Trzy błędy odtworzone przez koordynatora na dawnym liczniku — potwierdzone i usunięte u przyczyny:

| błąd | teraz | test |
|---|---|---|
| limit 1, dwa workery: 2 wywołania, licznik 1 | odczyt–sprawdzenie–zapis to jedna sekcja pod blokadą wyłączną (`open(…,'wx')`, przejęcie martwej blokady przez jeden `rename`) | 12 równoległych **procesów** na księdze z miejscem na 5 → dokładnie 5; ten sam test bez blokady pada 3/3 (6, 7 i 12 rezerwacji) |
| trzy nieudane `HOUSE_TRIAGE` nie zużywają licznika | każde żądanie (sortowanie i opis) rezerwuje kwotę i liczy się w dziennym limicie; nieudane zostawia rezerwację w całości | 3 awarie → 3 żądania, 3 pełne rezerwacje, czwarte niewysłane |
| uszkodzony plik zeruje licznik | stan nieparsowalny, niespójny albo zaginiony obok dziennika wyłącza czytnik do interwencji człowieka; nigdy start od zera | trzy rodzaje uszkodzeń + zaginięcie stanu |

Poza tym: **pułap skumulowany** w USD (z saldem otwarcia — księgę pilota otwiera się od 2,72807938 pod pułapem 5),
limity dzienne obok; rezerwacja zachowawcza (każdy obraz 5000 tokenów, całe pytanie, odpowiedź na pułapie tokenów,
cena katalogowa); rozliczenie w dół do zużycia podanego w odpowiedzi; **timeout, zerwane połączenie, błąd serwera,
anulowanie i odpowiedź bez zużycia zostawiają pełną rezerwację**; odmowa dostawcy przed uruchomieniem modelu
(400/401/403/404/413/429) i brak klucza ją zwracają; SDK bez własnych ponowień (jedno pytanie = najwyżej jedno
płatne żądanie); limity wejścia (liczba obrazów, bajty, długość pytania); model bez ceny w tabeli albo dostawca bez
pułapu odpowiedzi nie jest pytany. Ceny i zasada liczenia obrazów sprawdzone 2026-11-10 na stronach dostawcy
(Sonnet 5.5: 2/10 USD za MTok; Haiku 5.5: 0,10/0,50, powyżej 100 tys. tokenów promptu 0,50/2,50; obraz
⌈szer/28⌉×⌈wys/28⌉ tokenów, najwyżej 4784).

**Płatna ścieżka nie jest anonimowa.** Czytnik włącza się tylko przy `ANALYZER_HOUSE_READER=live`, pułapie
`ANALYZER_HOUSE_READER_MAX_USD` i tokenie `ANALYZER_HOUSE_READER_TOKEN`; zadanie sięga po niego wyłącznie, gdy
zgłoszenie niosło `Authorization: Bearer <token>` (zły token: 401; brak: ścieżka rysunkowa jak dotąd). Stara ścieżka
`ANALYZER_VISION=live` — bez księgi i tokenu, na każdym zadaniu — nie włącza się już samą flagą.

Czego to nie zapewnia: przetrwania utraty całego wolumenu (stan, kopia i dziennik razem). Zabezpieczeniem jest limit
wydatków ustawiony na samym kluczu w konsoli dostawcy — wpisane do instrukcji wdrożenia. To nie jest system billingowy.

## 2. Uwagi audytu styków (`research/source-to-model/S53-CLOSURE-FINDINGS.json`)

Dziesięć zapisanych opisów przebudowanych bez czytnika. Wynik oceniony w kontroli E3 zostaje w `S53-E3-RESULT.json`;
poniżej to praca DEV. Severity i sam audyt bez zmian.

| klasa | liczba | werdykt | po |
|---|---|---|---|
| taras–ściana, szczelina 2 cm | 13 | realny błąd budowniczego (taras 2 cm pod stopą ściany) | 0 |
| płyta zadaszenia w połaci dachu | 11 | realny (prześwit sprawdzany tylko w środku płyty) | 0 |
| płyta zadaszenia w ścianach/stropie bryły, słupy w ścianie | 11 | realny; za trzema — **forma gubiona w budowie** (podcień) | 0 |
| dwa zadaszenia w sobie; zadaszenie pod balkonem | 5 | realny | 0 |
| płyta dachu płaskiego w płaszczyźnie korony ścian | 4 | realny | 0 |
| krawędź zadaszenia kilka cm od lica | 3 | realny (brak dociągania do lic) | 0 |
| balkon przy lukarnie przebija okap | 2 | **ograniczenie reprezentacji z widoczną wadą** (model nie przerywa okapu) | 2 |
| zadaszenie jako „dach płaski": oczekiwane oparcie, którego nie ma | 3 | **artefakt reguły audytu, bez widocznej wady** (wysokości zapisane w pliku) | 3 |

Razem **50 → 5**; 7 z 10 modeli bez żadnej uwagi; 0 błędów kompilacji. Budowniczy 0.5.0.

Podcień: zadaszenie podane wewnątrz bryły na całej szerokości elewacji jest teraz budowane jako ściany cofnięte pod
własnym dachem bryły na słupach (jeden dom DEV; porównane z jego elewacjami bocznymi, które rysują dach nad otwartym
końcem na słupie). Płytkie (< 1 m) przy jednym licu — wysunięte przed lico. Podcień narożny lub na części elewacji —
nadal nazwany i niezbudowany (model ma typ `PocketV2`, budowniczy opisu go jeszcze nie używa).

**Opisane przez czytnik a zbudowane** (10 opisów): otwory 121/124, lukarny 2/2, okna połaciowe 9/13, kominy 12/12,
balkony 6/6, tarasy 10/10, zadaszenia 13/15. To, czego brakuje w tych liczbach, ginie w budowie i da się poprawiać bez
odczytów. Braki z kontroli (lukarny na jednym domu, drugie kominy, część okien połaciowych) to rzeczy, których czytnik
**nie opisał** — wymagają nowego odczytu.

Skutki uboczne: jedno okno opisane na boku otwartym teraz pod podcieniem odpada z nazwy; daszek 0,6 m na jednym domu
zakrywa okap i nie powstaje jako płyta; bryły z dachem płaskim mają attykę 0,15 m.

## 3. Routing (`research/source-to-model/S53-ROUTING.json`)

`analyseLink` nadal czyta najpierw rysunki. Opis jest wywoływany po odmowie albo po modelu z rysunków słabym wg własnego
wyniku: brak kotwicy metrycznej, model częściowy, zgubiona bryła, brak dachu. **Sama zweryfikowana skala lub zmierzona
wysokość już nie zamyka sprawy**; kompletny model bez tych słabości — tak, i wtedy czytnik nie jest pytany. To, co
rysunki zmierzyły (obrys przy zweryfikowanej skali, wysokość kondygnacji), przechodzi do modelu z opisu jako kotwice;
kotwica o innej proporcji niż opis jest odrzucana z nazwy, nie wymuszana. Model z rysunków zostaje obok.

Zmierzone na zapisanych wynikach (bez przebiegów): korpus 33 — czytnik byłby pytany dla 8 linków (3 słabe modele z 28
+ 5 odmów); strony innych wydawców — każdy z 10 modeli kaskady jest słaby wg reguły. Trzy przypadki „kotwica jest,
architektura słaba" istnieją w danych (2 w korpusie, 1 obcy). Pomiar wykrył błąd pierwszej wersji reguły (dachy z
samych połaci liczone jako brak dachu, 5 domów korpusu) — poprawione przed użyciem, z testem.

**Koszt wcześniejszej kaskady:** na 12 stronach pilota i kontroli kaskada zajęła 2096 s, opis 866 s (71 % czasu całej
ścieżki; 44–468 s wobec 43–113 s na stronę) i nie dała tam żadnej kotwicy. Na korpusie jest sama odpowiedzią dla 25 z
28 modeli. Kolejność zostaje — opis pierwszy lub równolegle oznaczałby płacenie za czytnik przy każdym linku — a jej
koszt jest podany. Cała ścieżka na bieżącym kodzie (zapieczętowane paczki, zapisane odpowiedzi): 51 s + 1,5 s budowy
(+ 43 s zapisanego czytnika); 0,3 s + 1,9 s; 69 s + 2,1 s (+ 95 s).

Niezmierzone: działanie kotwic na prawdziwym domu (żadna strona na dysku nie ma jednocześnie modelu ze zweryfikowaną
skalą i zapisanego opisu) — tylko testy na domu syntetycznym.

## 4. Podgląd fazy i tożsamość replay

- Rekord zadania ma `describing`: faza, powód, dostawca i lista faktycznie interpretowanych obrazów — osobno oryginał
  strony (adres, SHA-256, rozmiar) i wysłany JPEG (własny SHA-256, rozmiar, bajty). Żadnych znaczników ani linii.
- Postęp i etap nie cofają się; gdy czytnik jest dostępny, kaskada zajmuje 0,7 skali, opis resztę (wcześniej drugi
  etap stał w miejscu przy ~99 % albo cofał etap).
- `structuredVisionKey` obejmuje wersję czytnika, instrukcję, pytanie (z liczbami strony), schemat oraz numer, typ i
  bajty każdego obrazu. Zmienione pytanie to głośne pudło, nigdy stara odpowiedź. Przebudowa tego samego opisu to
  inny test i nie potrzebuje klucza.

## 5. Sprostowanie do raportu v3.53

Punkt 6 w §5 tamtego raportu („`anthropicVisionReasoner` używa wymuszonego `tool_choice`") był błędny: adapter używa
`tool_choice: auto` od E12. Prawdziwy problem tej ścieżki to brak księgi i tokenu — zamknięty w §1.

## 6. Prywatne uruchomienie i SDK — dokładna blokada

Prawdziwy adapter (oficjalne SDK, wynik strukturalny, bez ponowień) został uruchomiony w suchym przebiegu przez
produktową ścieżkę i księgę: żądanie dochodzi do API, bez klucza dostaje 401, rezerwacja 0,0107 USD wraca, księga
zostaje na 2,728079. **Płatnego odczytu nie wykonano.** Powód: bezpieczny formularz sekretów tej sesji nie przyjmuje
poświadczeń dla hostów dostawcy modelu, a wklejenie klucza do rozmowy jest wykluczone. Klucza z czatu nie użyto.

Bezpieczna ścieżka — klucz ustawiasz wyłącznie we własnym terminalu albo jako sekret hosta:

```
ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/s53/sdk-live.ts -- --url <strona DEV> \
  --cache <katalog prywatny> --books <katalog prywatny> --opening 2.72807938 --max 5 --out <katalog prywatny>
```

Jedno czytanie: rezerwacja ok. 0,3–0,4 USD, spodziewany koszt ok. 0,10 USD; wynik (`sdk-live.json`: modele żądane i
zwrócone, zużycie, czasy, kształt opisu obok zapisanego z CLI) nie zawiera klucza. Dwie niezależne generacje nie będą
równe bajt w bajt — porównuje się semantykę; równość bajtów obowiązuje dla przebudowy tego samego opisu.

Host dla telefonu — propozycja, nic nie zamówiono (`docs/ANALYZER_API.md`): repozytorium ma `fly.toml` (Warszawa,
2 współdzielone CPU, 2 GB, wolumen 3 GB, maszyna zatrzymywana w bezczynności) i zadanie CI wdrażające po dodaniu
sekretu `FLY_API_TOKEN`. Konto ani token nie istnieją. Wg cennika dostawcy z 2026-11-10: 13,39 USD/mies. przy pracy
ciągłej, przy zatrzymywaniu w bezczynności i kilku analizach dziennie rząd 1–2 USD/mies. (rachunek poniżej 5 USD jest
umarzany), wymagana karta. Decyzja należy do OWNER-a.

## 7. Testy

Macierz dotkniętych pakietów na **jednej rewizji `a2e2f45`** (`packages/{reconstruction,source-vision,source-package,
analysis-service,mobile-scene}`, `apps/{analyzer-api,local-analyzer}`, `tests/architecture`; pozostałych pakietów nie
uruchamiano): **2551 testów — 2529 przechodzi, 15 pada, 7 pominiętych**; `tsc --noEmit` czysto; paczka serwisu buduje
się. Piętnaście padających to co do nazwy zestaw sprzed kampanii (snapshot kontraktu Android, `/health`, cztery
strażniki izolacji badań, dwa testy modelu referencyjnego, cztery `wall-strip`, jeden `compound-facade`, NFD bez ICU,
scena Larchfield). Snapshot kontraktu Android był nieaktualny już wcześniej; ta praca dodaje do odpowiedzi nagłówek
CORS `authorization` i opcjonalne pole `describing` — snapshotu nie odświeżano. Poprzednie liczby (2511 na `7e0f563`,
95 na `e223cb2`) dotyczyły innych rewizji i zakresów.

## 8. Android — test do wykonania (NOT_VERIFIED)

Klient nie wysyła jeszcze tokenu pilota i nie pokazuje `describing`. Po działającym serwisie:
1. w ustawieniach analizatora: adres serwisu i token pilota; link strony DEV odrzucanej przez rysunki;
2. oczekiwane: postęp rośnie bez cofania, po kaskadzie widoczna faza czytania domu z listą obrazów (oryginał), bez
   żadnych linii na obrazach; wynik z etykietą „(model z opisu źródeł)" i ostrzeżeniem o przybliżonych wymiarach;
3. to samo bez tokenu: odmowa jak dotąd; ze złym tokenem: czytelny błąd 401;
4. skala czcionki 1,3 i obrót ekranu w trakcie zadania; ten sam podpis, versionCode ≥ 1328.

## 9. Co nadal jest błędne w domach

Kierunek kalenicy dobudówki dwuspadowej na rzucie kwadratowym; cechy dachu niedoczytane przez czytnik; balkon w
okapie; podcień narożny; okna połaciowe na połaciach końcowych i na dobudówkach poprzecznych; elewacje dwutonowe;
dachy ganków jako płaskie płyty. Dwanaście stron sześciu wydawców to nie „dowolny link". Ocena plansz przez OWNER-a
pozostaje do odbioru i nie jest tu zastąpiona.
