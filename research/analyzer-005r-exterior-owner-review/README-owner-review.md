# Recenzja zewnętrza 005R — instrukcja dla OWNER-a

Ten katalog to **lokalne narzędzie do ręcznego oznaczania**, co naprawdę widać na obrazach 14 projektów ARCHON
z badania 005R-EXTERIOR. Nic tu nie zgaduje odpowiedzi: każdą odpowiedź dajesz Ty, kliknięciem. Narzędzie działa
w przeglądarce **bez internetu** — nie wysyła plików, nie ma kluczy, liczników ani AI.

**Czego tu nie ma:** obrazów wydawcy. Repozytorium (i ten katalog) nie zawiera ani jednego piksela ARCHON. Obrazy
musisz mieć na swoim komputerze; strona sprawdza każdy plik skrótem SHA-256 i pokazuje tylko te, które dokładnie
pasują do pakietu.

> **Ograniczenie dostępu (ważne).** Kopia obrazów użytych w badaniu leży w zdalnym, tymczasowym kontenerze agenta.
> Nie masz do niej dostępu i ten etap jej nie przenosi: nie istnieje uzgodniony prywatny kanał przekazania pikseli
> wydawcy, a publikowanie ich w GitHubie jest wykluczone. Obrazy pobierasz więc sam, ręcznie, z publicznych stron
> projektów (krok 2). Agent sprawdził 2026-10-16 tylko nagłówki (bez pobierania obrazów), że te pliki nadal są pod
> tymi samymi adresami i mają tę samą długość; **zgodność bajtów potwierdzi dopiero strona na Twoim komputerze**.

## 1. Skopiuj pakiet

Potrzebujesz tylko: `review.html`, katalogów `tool/`, `pack/` i (do próby) `examples/`. Pliki Pythona są opcjonalne.
Najprościej: sklonuj repozytorium albo pobierz gałąź `analyzer/exterior-owner-truth-review-pack-v1` jako ZIP
i rozpakuj; potem otwórz `research/analyzer-005r-exterior-owner-review/`.

## 2. Zdobądź obrazy (ręcznie, z publicznych stron)

Otwórz każdą stronę poniżej w zwykłej przeglądarce i zapisz na dysk, do **jednego folderu** (np. `obrazy-005r`):

- **główne zdjęcie projektu** — kliknij je, żeby otworzyć powiększenie, i zapisz powiększony obraz
  („Zapisz obraz jako…”);
- **elewacje** — w zakładce z elewacjami otwórz każdą w powiększeniu i zapisz powiększenie;
- **zdjęcia z karuzel / galerii** (wizualizacje i wnętrza) — każde w powiększeniu.

Zapisuj obrazy w oryginale (nie zrzut ekranu, nie „kopiuj obraz” do edytora, nie konwersja formatu) — każda zmiana
bajtów sprawi, że strona nie dopasuje pliku. Nadmiar nie szkodzi: pliki spoza pakietu są po prostu pomijane.
Nazwy plików nie mają znaczenia.

- https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-g2e-m3ea28300f9b3e (Twoja edycja — najważniejsza)
- https://www.archon.pl/projekty-domow/projekt-willa-miranda-11-g2-m49324d69ef143
- https://www.archon.pl/projekty-domow/projekt-dom-w-arletach-3-e-oze-m504267f869cbe
- https://www.archon.pl/projekty-domow/projekt-dom-w-glogownikach-g-ma772868ccf62c
- https://www.archon.pl/projekty-domow/projekt-dom-w-helikoniach-3-e-oze-md6026d579e43f
- https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-e-oze-m738275b7537b0
- https://www.archon.pl/projekty-domow/projekt-dom-w-bratkach-26-r2be-m953292c7d56c7
- https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14 (Rarytasy 5 — **inna** edycja niż Twoja)
- https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca
- https://www.archon.pl/projekty-domow/projekt-dom-w-cieszyniankach-12-ge-m43d25c0636969
- https://www.archon.pl/projekty-domow/projekt-dom-w-czosnkach-e-ma7f290037d154
- https://www.archon.pl/projekty-domow/projekt-dom-w-jablonkach-22-mb0e2566e7cb18
- https://www.archon.pl/projekty-domow/projekt-dom-pod-jarzabem-15-g-mbad2613634abe
- https://www.archon.pl/projekty-domow/projekt-dom-w-tunbergiach-7-r2-md842941974a5c

Na pierwszą partię (34 pytania priorytetowe o 9 obrazach) wystarczą strony z pierwszych siedmiu pozycji listy.
8 z 35 obrazów pakietu (wizualizacje z karuzel, tylko pytania dodatkowe) nie ma w statycznym HTML-u bieżących stron
(7 z nich jest pod dawnym adresem z tą samą długością, 1 ma już inną długość); możliwe, że galeria ładuje je
skryptem — jeśli ich nie znajdziesz, te pytania zostaną `SOURCE_IMAGE_UNAVAILABLE`.

Świadomie: oglądając stronę widzisz też podpisy i kategorie wydawcy. „Ślepota” narzędzia dotyczy chwili odpowiadania
— w trakcie fazy 1 strona nie pokazuje Ci żadnej etykiety wydawcy ani wyniku B1, a pytania są wymieszane między
domami bez nazw. Najlepiej pobierz obrazy jednego dnia, a odpowiadaj innego.

## 3. Otwórz narzędzie

Kliknij dwukrotnie `review.html` (Chrome, Edge, Firefox). Na górze widać „Faza 1: ślepa” i licznik `odpowiedzi 0/60`.
Jeśli przeglądarka nie uruchamia skryptów z pliku lokalnego, użyj zapasowego serwera tylko dla tego komputera:

```
python3 -I serve_local.py          # potem otwórz http://127.0.0.1:8765/review.html
```

Serwer słucha wyłącznie na 127.0.0.1, nie ma listingu katalogów i nie przyjmuje wysyłania plików.

**Najpierw próba na danych syntetycznych (zalecane, 2 minuty):**

```
python3 -I make_synthetic_demo.py ~/obrazy-syntetyczne     # pięć wymyślonych obrazków BMP, poza repozytorium
```

i otwórz `review.html?pack=synthetic` (przy `file://` dopisz `?pack=synthetic` w pasku adresu). Wybierz pliki
z `~/obrazy-syntetyczne`: dopasuje się 4 z 5 obrazów (piąty celowo nie istnieje → `SOURCE_IMAGE_UNAVAILABLE`).
Plik `examples/example-labels-SYNTHETIC.json` to przykład wypełnionych etykiet — **wszystkie wymyślone** i oznaczone
`SYNTHETIC_EXAMPLE`; do prawdziwego pakietu nie da się go zaimportować.

## 4. Faza 1 — odpowiedzi ślepe

1. W sekcji „1. Obrazy z Twojego dysku” wskaż folder z obrazami (albo zaznacz pliki / upuść je). Status pokaże
   „Dopasowano N z 35 obrazów pakietu”.
2. Filtr „priorytet” pokazuje 34 pierwsze pytania (wszystkie pytania o 9 obrazach — priorytet dotyczy obrazu,
   nie tego, co twierdzi wydawca). Dla każdego pytania kliknij jedną odpowiedź:
   - **Widać** (`PRESENT`), **Nie ma — miejsce jest widoczne** (`ABSENT`), **Nie pokazane** (`NOT_SHOWN` — ta część domu
     nie mieści się w kadrze), **Nie da się ocenić** (`CANNOT_TELL`);
   - pytanie o scenę: zewnętrze / wnętrze / jedno i drugie / rysunek techniczny / nie da się ocenić.
   Wnętrze nie jest cechą zewnętrza: okno albo słup we wnętrzu nie jest odpowiedzią „Widać” dla cechy zewnętrznej.
3. Opcjonalnie: przy „Widać” rodzaj zadaszenia (ażurowe / pełne / brak / nie wiem) i obszar na obrazie (przycisk
   „Zaznacz obszar” i przeciągnięcie); przy każdej odpowiedzi strona domu i lustrzane odbicie — **tylko jeśli masz
   pewność**.
4. Brak odpowiedzi nigdy nie jest „Nie ma”: pytanie, którego nie dotkniesz, zostaje `UNREVIEWED`.
5. Gdy dla pytania nie ma pliku, możesz świadomie wybrać „Obejrzę obraz na stronie wydawcy” — odpowiedź zostanie
   zapisana jako **nie ślepa** (`MANUAL_PAGE_FALLBACK_NOT_BLIND`) i bez skrótu bajtów.

Sesja zapisuje się w tej przeglądarce (możesz zamknąć i wrócić); pliki obrazów trzeba po powrocie wskazać ponownie.
Uwaga: przy otwieraniu z pliku (`file://`) przeglądarka dzieli tę pamięć z innymi lokalnymi plikami HTML — nie otwieraj
w trakcie recenzji obcych lokalnych stron; plikiem prawdy jest eksport, nie pamięć przeglądarki.
Skróty: `1`–`5` odpowiedź, `←` `→` nawigacja.

## 5. Pieczęć i faza 2 — kontrola techniczna

„Zapieczętuj fazę 1” zamraża odpowiedzi ślepe (skrót SHA-256) i zamyka okno ślepe dla **wszystkich** pytań — po
pieczęci nie da się już odpowiedzieć ślepo na pominięte. Można zapieczętować po samej partii priorytetowej.
**Zanim otworzysz fazę 2, wyślij koordynatorowi skrót pieczęci** (widoczny w sekcji 2) albo eksport z tej chwili:
skrót wykrywa przypadkowe zmiany, ale nie chroni przed kimś, kto świadomie zmieni odpowiedź i przeliczy skrót.
Po pokazaniu fazy 2 ta przeglądarka nie pozwoli już odpowiadać ślepo (także po „Wyczyść sesję”).

Dopiero wtedy przy pytaniu pojawia się kontekst: kanał i kategoria wydawcy, status B1 i przeliczenie ścisłe, plan
pomieszczeń, cechy z produkcji, inne pytania tej samej edycji (np. jej elewacja) i link do strony projektu. Zaznacz,
czy rysunek techniczny pokazuje cechę i skąd to wiesz. Jeśli obraz i rysunek mówią co innego, zostaje **konflikt** —
odpowiedź z fazy 1 nie zmienia się nigdy. Pytania o scenę dostają tylko „kontekst źródła zgadza się / nie zgadza”,
bo układ galerii wydawcy nie jest dowodem technicznym. Nigdzie nie zapisuje się wymiarów ani liczb.

## 6. Eksport

„Eksport JSON” (i CSV) zapisuje plik z identyfikatorami, skrótami bajtów i Twoimi odpowiedziami: bez obrazów, adresów
i tekstu wydawcy. Czas odpowiedzi jest zapisywany tylko, jeśli zaznaczysz tę opcję. Ten plik przekaż koordynatorowi.
„Import JSON” wczytuje wcześniejszy eksport (wznowienie pracy); strona odrzuca plik niespójny z pieczęcią, z
odpowiedzią przeniesioną na inną edycję albo z czymkolwiek spoza słownika. To samo sprawdza wiersz poleceń:

```
node tool/validate-labels.mjs owner-review-labels-archon-005r-exterior-owner-review-v1.json
```

## Co dalej (nie w tym etapie)

Wyjątek izolacji: jedno zdjęcie wnętrza Twojej edycji jest bajtowo identyczne z plikami innych edycji Rarytasów
(także Rarytasy 5 G2E). Odpowiedź o nim zapisuje się tylko pod Twoją edycją i nie jest przenoszona dalej.

Dopiero ukończona recenzja i **osobna** bramka oceny pozwolą mówić o trafności jakiegokolwiek czytnika. Do tego czasu
każda dokładność klasy i każdy zysk są `NOT_MEASURED`. Nawet potem próba jest mała (≤ 60 pytań, 14 edycji, 35 obrazów,
jedna osoba), a edycje jednej rodziny i wspólne obrazy są skorelowane.

## Pliki

| plik | rola |
| --- | --- |
| `review.html`, `tool/` | strona i jej reguły (`review-core.js` — ten sam walidator w przeglądarce i w Node) |
| `pack/queue.json` / `.js` | kolejka ślepa: 60 pytań (34 priorytetowe), kotwice (edycja, grupa linii, skrót bajtów), bez etykiet wydawcy |
| `pack/crosscheck.json` / `.js` | kontekst fazy 2, wczytywany dopiero po pieczęci |
| `pack/manual-locator.json` / `.js` | strona + miejsce obrazu, tylko dla trybu nie-ślepego |
| `pack/labels-template-EMPTY.json` | pusty szablon etykiet (wszystko `UNREVIEWED`) |
| `examples/` | pakiet syntetyczny i przykład etykiet `SYNTHETIC_EXAMPLE` |
| `results/` | pokrycie, wykluczenia, sprawdzenie dostępności stron |
| `build_pack.py`, `check_page_access.py`, `make_synthetic_demo.py`, `serve_local.py`, `test/` | budowa i testy |
| `preregistration.md` | reguły kolejki i schematy, spisane przed kodem |
